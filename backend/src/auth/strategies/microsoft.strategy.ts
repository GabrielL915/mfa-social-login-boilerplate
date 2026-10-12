import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-microsoft';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy, 'microsoft') {
  constructor(config: ConfigService, private users: UsersService) {
    super({
      clientID: config.get('MICROSOFT_CLIENT_ID') || 'not-configured',
      clientSecret: config.get('MICROSOFT_CLIENT_SECRET') || 'not-configured',
      callbackURL: `${config.get('BACKEND_URL')}/auth/microsoft/callback`,
      scope: ['user.read'],
      tenant: config.get('MICROSOFT_TENANT') ?? 'common',
    });
  }

  async validate(_at: string, _rt: string, profile: any) {
    const email =
      profile.emails?.[0]?.value ?? profile._json?.mail ?? profile._json?.userPrincipalName;
    return this.users.findOrCreateSocial({
      provider: 'microsoft',
      providerId: profile.id,
      email,
      name: profile.displayName,
    });
  }
}
