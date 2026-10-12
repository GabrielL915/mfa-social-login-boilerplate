import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-apple';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

/**
 * Apple so manda nome na PRIMEIRA autorizacao (vem em req.body.user).
 * O email sempre vem dentro do idToken (decodificado pelo passport-apple).
 * Callback da Apple e POST (response_mode=form_post), por isso o controller usa @Post.
 */
@Injectable()
export class AppleStrategy extends PassportStrategy(Strategy, 'apple') {
  constructor(config: ConfigService, private users: UsersService) {
    super({
      clientID: config.get('APPLE_CLIENT_ID') || 'not-configured',
      teamID: config.get('APPLE_TEAM_ID') || 'not-configured',
      keyID: config.get('APPLE_KEY_ID') || 'not-configured',
      privateKeyString: (config.get<string>('APPLE_PRIVATE_KEY') ?? '').replace(/\\n/g, '\n'),
      callbackURL: `${config.get('BACKEND_URL')}/auth/apple/callback`,
      scope: ['name', 'email'],
      passReqToCallback: true,
    });
  }

  async validate(req: any, _at: string, _rt: string, idToken: any, _profile: any) {
    const sub: string = idToken?.sub;
    const email: string = idToken?.email;
    let name: string | undefined;
    if (req.body?.user) {
      try {
        const u = typeof req.body.user === 'string' ? JSON.parse(req.body.user) : req.body.user;
        name = [u?.name?.firstName, u?.name?.lastName].filter(Boolean).join(' ') || undefined;
      } catch {
        /* ignore */
      }
    }
    return this.users.findOrCreateSocial({ provider: 'apple', providerId: sub, email, name });
  }
}
