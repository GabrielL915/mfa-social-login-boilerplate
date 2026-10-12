import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService, private users: UsersService) {
    super({
      clientID: config.get('GOOGLE_CLIENT_ID') || 'not-configured',
      clientSecret: config.get('GOOGLE_CLIENT_SECRET') || 'not-configured',
      callbackURL: `${config.get('BACKEND_URL')}/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  async validate(_at: string, _rt: string, profile: Profile) {
    return this.users.findOrCreateSocial({
      provider: 'google',
      providerId: profile.id,
      email: profile.emails?.[0]?.value,
      name: profile.displayName,
    });
  }
}
