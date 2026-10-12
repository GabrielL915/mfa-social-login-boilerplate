import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { toDataURL } from 'qrcode';
import { randomBytes } from 'crypto';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';

export interface AccessPayload { sub: string; email: string; mfa: boolean }
export interface MfaTempPayload { sub: string; purpose: 'mfa' }

export type PrimaryAuthResult =
  | { mfaRequired: true; mfaToken: string }
  | { mfaRequired: false; accessToken: string };

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  // ---------- registro / login local ----------
  async register(email: string, password: string, name: string) {
    if (await this.users.findByEmail(email)) throw new BadRequestException('Email ja cadastrado');
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.users.create({ email, name, passwordHash, provider: 'local' });
    return this.issueAfterPrimaryAuth(user);
  }

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Credenciais invalidas');
    }
    return this.issueAfterPrimaryAuth(user);
  }

  /**
   * Ponto central: apos o 1o fator (senha OU social), decide se emite
   * access token direto ou um mfaToken temporario exigindo o 2o fator.
   */
  async issueAfterPrimaryAuth(user: User): Promise<PrimaryAuthResult> {
    if (user.mfaEnabled) {
      const mfaToken = this.jwt.sign(
        { sub: user.id, purpose: 'mfa' } as MfaTempPayload,
        { secret: this.config.get('MFA_TOKEN_SECRET'), expiresIn: '5m' },
      );
      return { mfaRequired: true, mfaToken };
    }
    return { mfaRequired: false, accessToken: this.signAccess(user) };
  }

  private signAccess(user: User) {
    const payload: AccessPayload = { sub: user.id, email: user.email, mfa: user.mfaEnabled };
    return this.jwt.sign(payload);
  }

  // ---------- 2o fator no login ----------
  async verifyMfaLogin(mfaToken: string, code: string) {
    let payload: MfaTempPayload;
    try {
      payload = this.jwt.verify(mfaToken, { secret: this.config.get('MFA_TOKEN_SECRET') });
    } catch {
      throw new UnauthorizedException('mfaToken invalido ou expirado');
    }
    if (payload.purpose !== 'mfa') throw new UnauthorizedException();

    const user = await this.users.findById(payload.sub);
    if (!user?.mfaEnabled || !user.mfaSecret) throw new UnauthorizedException();

    const ok = authenticator.check(code, user.mfaSecret) || (await this.consumeRecoveryCode(user, code));
    if (!ok) throw new UnauthorizedException('Codigo invalido');

    return { accessToken: this.signAccess(user) };
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
    const otpauth = authenticator.keyuri(user.email, this.config.get('MFA_ISSUER') ?? 'App', secret);
    const qrDataUrl = await toDataURL(otpauth);
    return { secret, otpauth, qrDataUrl };
  }

  async mfaEnable(userId: string, code: string) {
    const user = await this.users.findById(userId);
    if (!user.mfaSecret) throw new BadRequestException('Chame /auth/mfa/setup antes');
    if (!authenticator.check(code, user.mfaSecret)) throw new BadRequestException('Codigo invalido');

    const plain = Array.from({ length: 8 }, () => randomBytes(5).toString('hex'));
    const hashed = await Promise.all(plain.map((c) => bcrypt.hash(c, 10)));
    const updated = await this.users.update(user.id, { mfaEnabled: true, mfaRecoveryCodes: hashed });
    return { recoveryCodes: plain, accessToken: this.signAccess(updated) };
  }

  async mfaDisable(userId: string, code: string) {
    const user = await this.users.findById(userId);
    if (!user.mfaEnabled) throw new BadRequestException('MFA nao esta ativo');
    if (!authenticator.check(code, user.mfaSecret)) throw new BadRequestException('Codigo invalido');
    await this.users.update(user.id, { mfaEnabled: false, mfaSecret: undefined, mfaRecoveryCodes: [] });
    return { ok: true };
  }

  // ---------- social: redireciona pro front carregando o resultado ----------
  buildSocialRedirect(result: PrimaryAuthResult) {
    const base = `${this.config.get('FRONTEND_URL')}/auth/callback`;
    if (result.mfaRequired === true) return `${base}?mfaToken=${encodeURIComponent(result.mfaToken)}`;
    return `${base}?accessToken=${encodeURIComponent(result.accessToken)}`;
  }
}
