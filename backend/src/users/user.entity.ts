export type Provider = 'local' | 'google' | 'microsoft' | 'apple' | 'sso';

export interface User {
  id: string;
  /** CPF so digitos, UNIQUE. Ausente = cadastro incompleto (veio de social/SSO). */
  cpf?: string;
  email: string;            // UNIQUE, usado pra comunicacao e pra linkar login social
  name?: string;
  passwordHash?: string;
  provider: Provider;       // como a conta foi criada
  providerId?: string;
  linkedProviders?: { provider: Provider; providerId: string }[]; // logins sociais vinculados
  mfaEnabled: boolean;
  mfaSecret?: string;         // TOTP secret (criptografar em prod)
  mfaRecoveryCodes?: string[]; // hashes bcrypt
}
