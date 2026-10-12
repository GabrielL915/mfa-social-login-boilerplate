import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Issuer, Client, generators } from 'openid-client';
import { SAML } from '@node-saml/node-saml';
import { SsoConnectionsService } from './sso-connections.service';
import { SsoConnection } from './sso-connection.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from '../auth/auth.service';
import { devBypassEnabled } from '../common/dev-bypass';

/** Estado assinado que vai e volta no fluxo (no lugar de sessao server-side). */
interface SsoState { cid: string; nonce?: string; verifier?: string }

@Injectable()
export class SsoService {
  private oidcClients = new Map<string, Promise<Client>>();

  constructor(
    private connections: SsoConnectionsService,
    private users: UsersService,
    private auth: AuthService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  private get backendUrl() {
    return (this.config.get<string>('BACKEND_URL') ?? 'http://localhost:3000').replace(/\/$/, '');
  }

  /** Passo 1: usuario digita o email, a gente descobre o IdP e devolve a URL de redirect. */
  async startByEmail(email: string) {
    const conn = this.connections.byEmail(email);
    if (!conn) {
      // DEV: sem conexao cadastrada, usa o IdP fake interno pra ver o funil inteiro
      if (devBypassEnabled()) return `${this.backendUrl}/sso/dev/callback?email=${encodeURIComponent(email)}`;
      throw new BadRequestException('Nenhuma conexao SSO para este dominio');
    }
    return this.startByConnection(conn, email);
  }

  async startByConnection(conn: SsoConnection, loginHint?: string): Promise<string> {
    if (conn.type === 'oidc') return this.oidcAuthUrl(conn, loginHint);
    return this.samlAuthUrl(conn);
  }

  // ---------------- OIDC ----------------
  private oidcClient(conn: Extract<SsoConnection, { type: 'oidc' }>) {
    if (!this.oidcClients.has(conn.id)) {
      this.oidcClients.set(
        conn.id,
        Issuer.discover(conn.oidc.issuer).then(
          (issuer) =>
            new issuer.Client({
              client_id: conn.oidc.clientId,
              client_secret: conn.oidc.clientSecret,
              redirect_uris: [`${this.backendUrl}/sso/oidc/callback`],
              response_types: ['code'],
            }),
        ),
      );
    }
    return this.oidcClients.get(conn.id)!;
  }

  private async oidcAuthUrl(conn: Extract<SsoConnection, { type: 'oidc' }>, loginHint?: string) {
    const client = await this.oidcClient(conn);
    const nonce = generators.nonce();
    const verifier = generators.codeVerifier();
    const state = this.signState({ cid: conn.id, nonce, verifier });
    return client.authorizationUrl({
      scope: conn.oidc.scope ?? 'openid profile email',
      state,
      nonce,
      code_challenge: generators.codeChallenge(verifier),
      code_challenge_method: 'S256',
      ...(loginHint ? { login_hint: loginHint } : {}),
    });
  }

  async oidcCallback(query: Record<string, any>) {
    const st = this.readState(query.state);
    const conn = this.connections.byId(st.cid);
    if (conn.type !== 'oidc') throw new BadRequestException();
    const client = await this.oidcClient(conn);
    const params = client.callbackParams({ method: 'GET', url: '/?' + new URLSearchParams(query).toString() } as any);
    const tokens = await client.callback(`${this.backendUrl}/sso/oidc/callback`, params, {
      state: query.state,
      nonce: st.nonce,
      code_verifier: st.verifier,
    });
    const claims = tokens.claims();
    const email = (claims.email ?? claims.preferred_username ?? claims.upn) as string | undefined;
    if (!email) throw new UnauthorizedException('IdP nao retornou email');
    return this.finish(conn, claims.sub, email, (claims.name as string) ?? undefined);
  }

  // ---------------- SAML ----------------
  private saml(conn: Extract<SsoConnection, { type: 'saml' }>) {
    return new SAML({
      entryPoint: conn.saml.entryPoint,
      issuer: conn.saml.issuer ?? `${this.backendUrl}/sso/saml/metadata/${conn.id}`,
      callbackUrl: `${this.backendUrl}/sso/saml/callback/${conn.id}`,
      idpCert: conn.saml.idpCert,
      wantAssertionsSigned: true,
      wantAuthnResponseSigned: false,
    });
  }

  private async samlAuthUrl(conn: Extract<SsoConnection, { type: 'saml' }>) {
    return this.saml(conn).getAuthorizeUrlAsync(this.signState({ cid: conn.id }), undefined, {});
  }

  async samlCallback(connectionId: string, body: Record<string, any>) {
    const conn = this.connections.byId(connectionId);
    if (conn.type !== 'saml') throw new BadRequestException();
    const { profile } = await this.saml(conn).validatePostResponseAsync(body as any);
    if (!profile) throw new UnauthorizedException('Resposta SAML invalida');
    const email = (profile.email ?? profile.nameID ?? profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress']) as string;
    const name = (profile.displayName ?? profile['http://schemas.microsoft.com/identity/claims/displayname']) as string | undefined;
    return this.finish(conn, profile.nameID, email, name);
  }

  samlMetadata(connectionId: string) {
    const conn = this.connections.byId(connectionId);
    if (conn.type !== 'saml') throw new BadRequestException();
    return this.saml(conn).generateServiceProviderMetadata(null, null);
  }

  // ---------------- DEV: IdP fake ----------------
  /** Autentica qualquer email como se o IdP da empresa tivesse aprovado. So com DEV_AUTH_BYPASS. */
  async devCallback(email: string) {
    if (!devBypassEnabled()) throw new NotFoundException();
    if (!email?.includes('@')) throw new BadRequestException('email invalido');
    const user = await this.users.findOrCreateSocial({
      provider: 'sso',
      providerId: `dev:${email.toLowerCase()}`,
      email,
      name: email.split('@')[0],
    });
    const result = await this.auth.issueAfterPrimaryAuth(user);
    return this.auth.buildSocialRedirect(result);
  }

  // ---------------- comum ----------------
  /**
   * Garante que o email autenticado pertence ao dominio da conexao
   * (evita um IdP de outra empresa afirmar email@suaempresa.com),
   * acha/cria o usuario e entra no mesmo funil de MFA do resto do app.
   */
  private async finish(conn: SsoConnection, providerId: string, email: string, name?: string) {
    if (email.split('@')[1]?.toLowerCase() !== conn.domain) {
      throw new UnauthorizedException('Email fora do dominio da conexao SSO');
    }
    const user = await this.users.findOrCreateSocial({ provider: 'sso', providerId, email, name });
    const result = await this.auth.issueAfterPrimaryAuth(user);
    return this.auth.buildSocialRedirect(result);
  }

  private signState(s: SsoState) {
    return this.jwt.sign(s, { secret: this.config.get('MFA_TOKEN_SECRET'), expiresIn: '10m' });
  }

  private readState(state?: string): SsoState {
    try {
      return this.jwt.verify(state ?? '', { secret: this.config.get('MFA_TOKEN_SECRET') });
    } catch {
      throw new UnauthorizedException('state invalido ou expirado');
    }
  }
}
