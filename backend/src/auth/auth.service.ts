import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { toDataURL } from 'qrcode';
import { randomBytes } from 'crypto';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { normalizeCpf } from '../users/cpf';
import { DEV_MFA_CODE, devBypassEnabled } from '../common/dev-bypass';

/** Nunca colocar CPF aqui: o JWT e legivel por quem tiver o token. */
export interface AccessPayload { sub: string; email: string; mfa: boolean }
export interface TempPayload { sub: string; purpose: 'mfa' | 'profile' }

export type PrimaryAuthResult =
  | { step: 'profile'; profileToken: string }   // falta CPF (veio de social/SSO)
  | { step: 'mfa'; mfaToken: string }           // 2o fator
  | { step: 'done'; accessToken: string };

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  // ---------- registro / login local (CPF + senha) ----------
  async register(cpfInput: string, email: string, password: string, name: string) {
    const cpf = normalizeCpf(cpfInput);
    if (!cpf) throw new BadRequestException('CPF invalido');
    if (await this.users.findByCpf(cpf)) throw new ConflictException('CPF ja cadastrado');
    if (await this.users.findByEmail(email)) throw new ConflictException('Email ja cadastrado');
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.users.create({ cpf, email, name, passwordHash, provider: 'local' });
    return this.issueAfterPrimaryAuth(user);
  }

  async login(cpfInput: string, password: string) {
    const cpf = normalizeCpf(cpfInput);
    const user = cpf ? await this.users.findByCpf(cpf) : undefined;
    // mesma mensagem pra CPF inexistente e senha errada (nao revelar se o CPF existe)
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('CPF ou senha invalidos');
    }
    return this.issueAfterPrimaryAuth(user);
  }

  /**
   * Ponto central apos o 1o fator (senha, social ou SSO).
   * 1) sem CPF -> completar cadastro; 2) MFA ativo -> 2o fator; 3) access token.
   */
  async issueAfterPrimaryAuth(user: User): Promise<PrimaryAuthResult> {
    if (!user.cpf) {
      return { step: 'profile', profileToken: this.signTemp(user.id, 'profile', '15m') };
    }
    if (user.mfaEnabled) {
      return { step: 'mfa', mfaToken: this.signTemp(user.id, 'mfa', '5m') };
    }
    return { step: 'done', accessToken: this.signAccess(user) };
  }

  private signTemp(sub: string, purpose: TempPayload['purpose'], expiresIn: string) {
    return this.jwt.sign({ sub, purpose } as TempPayload, { secret: this.config.get('MFA_TOKEN_SECRET'), expiresIn });
  }

  private readTemp(token: string, purpose: TempPayload['purpose']): TempPayload {
    let payload: TempPayload;
    try {
      payload = this.jwt.verify(token, { secret: this.config.get('MFA_TOKEN_SECRET') });
    } catch {
      throw new UnauthorizedException('Token temporario invalido ou expirado');
    }
    if (payload.purpose !== purpose) throw new UnauthorizedException();
    return payload;
  }

  private signAccess(user: User) {
    const payload: AccessPayload = { sub: user.id, email: user.email, mfa: user.mfaEnabled };
    return this.jwt.sign(payload);
  }

  // ---------- completar cadastro (social/SSO sem CPF) ----------
  async completeProfile(profileToken: string, cpfInput: string) {
    const { sub } = this.readTemp(profileToken, 'profile');
    const user = await this.users.findById(sub);
    if (!user) throw new UnauthorizedException();
    if (user.cpf) return this.issueAfterPrimaryAuth(user); // ja completo, segue o funil

    const cpf = normalizeCpf(cpfInput);
    if (!cpf) throw new BadRequestException('CPF invalido');

    const owner = await this.users.findByCpf(cpf);
    if (owner && owner.id !== user.id) {
      // Outra conta tem esse CPF. NAO vincular automaticamente: quem clicou no Google
      // precisa provar que e dono daquela conta (senha) -> /auth/profile/link
      throw new ConflictException({
        statusCode: 409,
        code: 'CPF_IN_USE',
        message: 'Este CPF ja tem conta. Digite a senha dela para vincular seu login social.',
        canLink: !!owner.passwordHash,
      });
    }

    const updated = await this.users.update(user.id, { cpf });
    return this.issueAfterPrimaryAuth(updated);
  }

  /** Vincula o login social recem-criado a conta existente dona do CPF, provando a senha. */
  async linkAccount(profileToken: string, cpfInput: string, password: string) {
    const { sub } = this.readTemp(profileToken, 'profile');
    const social = await this.users.findById(sub);
    if (!social || social.cpf) throw new UnauthorizedException();

    const cpf = normalizeCpf(cpfInput);
    const owner = cpf ? await this.users.findByCpf(cpf) : undefined;
    if (!owner?.passwordHash || !(await bcrypt.compare(password, owner.passwordHash))) {
      throw new UnauthorizedException('CPF ou senha invalidos');
    }

    if (social.providerId) await this.users.linkProvider(owner.id, social.provider, social.providerId);
    await this.users.delete(social.id); // a conta temporaria do social some
    return this.issueAfterPrimaryAuth(owner); // MFA da conta dona ainda se aplica
  }

  // ---------- 2o fator no login ----------
  async verifyMfaLogin(mfaToken: string, code: string) {
    const { sub } = this.readTemp(mfaToken, 'mfa');
    const user = await this.users.findById(sub);
    if (!user?.mfaEnabled || !user.mfaSecret) throw new UnauthorizedException();

    const ok = this.checkTotp(code, user.mfaSecret) || (await this.consumeRecoveryCode(user, code));
    if (!ok) throw new UnauthorizedException('Codigo invalido');

    return { accessToken: this.signAccess(user) };
  }

  /** TOTP real, ou 000000 quando DEV_AUTH_BYPASS esta ligado. */
  private checkTotp(code: string, secret?: string) {
    if (devBypassEnabled() && code === DEV_MFA_CODE) return true;
    return !!secret && authenticator.check(code, secret);
  }

  private async consumeRecoveryCode(user: User, code: string) {
    const codes = user.mfaRecoveryCodes ?? [];
    for (let i = 0; i < codes.length; i++) {
      if (await bcrypt.compare(code, codes[i])) {
        codes.splice(i, 1);
        await this.users.update(user.id, { mfaRecoveryCodes: codes });
        return true;
      }
    }
    return false;
  }

  // ---------- setup / ativacao / desativacao do MFA (usuario logado) ----------
  async mfaSetup(userId: string) {
    const user = await this.users.findById(userId);
    if (user.mfaEnabled) throw new BadRequestException('MFA ja ativo');
    const secret = authenticator.generateSecret();
    await this.users.update(user.id, { mfaSecret: secret }); // pendente ate confirmar
    // rotulo no app autenticador = email (nao expor CPF ali)
    const otpauth = authenticator.keyuri(user.email, this.config.get('MFA_ISSUER') ?? 'App', secret);
    const qrDataUrl = await toDataURL(otpauth);
    return { secret, otpauth, qrDataUrl };
  }

  async mfaEnable(userId: string, code: string) {
    const user = await this.users.findById(userId);
    if (!user.mfaSecret) throw new BadRequestException('Chame /auth/mfa/setup antes');
    if (!this.checkTotp(code, user.mfaSecret)) throw new BadRequestException('Codigo invalido');

    const plain = Array.from({ length: 8 }, () => randomBytes(5).toString('hex'));
    const hashed = await Promise.all(plain.map((c) => bcrypt.hash(c, 10)));
    const updated = await this.users.update(user.id, { mfaEnabled: true, mfaRecoveryCodes: hashed });
    return { recoveryCodes: plain, accessToken: this.signAccess(updated) };
  }

  async mfaDisable(userId: string, code: string) {
    const user = await this.users.findById(userId);
    if (!user.mfaEnabled) throw new BadRequestException('MFA nao esta ativo');
    if (!this.checkTotp(code, user.mfaSecret)) throw new BadRequestException('Codigo invalido');
    await this.users.update(user.id, { mfaEnabled: false, mfaSecret: undefined, mfaRecoveryCodes: [] });
    return { ok: true };
  }

  // ---------- social/SSO: redireciona pro front carregando o resultado ----------
  buildSocialRedirect(result: PrimaryAuthResult) {
    const base = `${this.config.get('FRONTEND_URL')}/auth/callback`;
    if (result.step === 'profile') return `${base}?profileToken=${encodeURIComponent(result.profileToken)}`;
    if (result.step === 'mfa') return `${base}?mfaToken=${encodeURIComponent(result.mfaToken)}`;
    return `${base}?accessToken=${encodeURIComponent(result.accessToken)}`;
  }
}
