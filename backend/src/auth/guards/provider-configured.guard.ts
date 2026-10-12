import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const REQUIRED: Record<string, string[]> = {
  google: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  microsoft: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'],
  apple: ['APPLE_CLIENT_ID', 'APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY'],
};

/** Bloqueia /auth/:provider com erro claro se as variaveis do provider estiverem vazias. */
@Injectable()
export class ProviderConfiguredGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(ctx: ExecutionContext) {
    const path: string = ctx.switchToHttp().getRequest().path ?? '';
    const provider = Object.keys(REQUIRED).find((p) => path.includes(`/auth/${p}`));
    if (!provider) return true;
    const missing = REQUIRED[provider].filter((k) => !this.config.get(k));
    if (missing.length) {
      throw new ServiceUnavailableException(
        `Login com ${provider} nao configurado. Defina no .env: ${missing.join(', ')}`,
      );
    }
    return true;
  }
}
