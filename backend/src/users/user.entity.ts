export type Provider = 'local' | 'google' | 'microsoft' | 'apple';

export interface User {
  id: string;
  email: string;
  name?: string;
  passwordHash?: string;
  provider: Provider;
  providerId?: string;
  mfaEnabled: boolean;
  mfaSecret?: string;        // TOTP secret (criptografar em prod)
  mfaRecoveryCodes?: string[]; // hashes bcrypt
}
