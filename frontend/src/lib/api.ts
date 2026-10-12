export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type PrimaryAuthResult =
  | { step: 'profile'; profileToken: string }
  | { step: 'mfa'; mfaToken: string }
  | { step: 'done'; accessToken: string };

export class ApiError extends Error {
  constructor(public status: number, message: string, public body: any) {
    super(message);
  }
}

async function request<T>(path: string, body?: unknown, token?: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Nest: { message, statusCode } ou, em excecoes com objeto, o objeto em si ({ code, message, ... })
    throw new ApiError(res.status, data.message ?? 'Erro na requisicao', data);
  }
  return data as T;
}

export const api = {
  register: (cpf: string, email: string, password: string, name: string) =>
    request<PrimaryAuthResult>('/auth/register', { cpf, email, password, name }),
  login: (cpf: string, password: string) =>
    request<PrimaryAuthResult>('/auth/login', { cpf, password }),
  profileComplete: (profileToken: string, cpf: string) =>
    request<PrimaryAuthResult>('/auth/profile/complete', { profileToken, cpf }),
  profileLink: (profileToken: string, cpf: string, password: string) =>
    request<PrimaryAuthResult>('/auth/profile/link', { profileToken, cpf, password }),
  mfaVerify: (mfaToken: string, code: string) =>
    request<{ accessToken: string }>('/auth/mfa/verify', { mfaToken, code }),
  me: (token: string) => request<any>('/auth/me', undefined, token),
  mfaSetup: (token: string) =>
    request<{ secret: string; otpauth: string; qrDataUrl: string }>('/auth/mfa/setup', {}, token),
  mfaEnable: (token: string, code: string) =>
    request<{ recoveryCodes: string[]; accessToken: string }>('/auth/mfa/enable', { code }, token),
  mfaDisable: (token: string, code: string) =>
    request<{ ok: true }>('/auth/mfa/disable', { code }, token),
  ssoStart: (email: string) => request<{ url: string }>('/sso/start', { email }),
  socialUrl: (provider: 'google' | 'microsoft' | 'apple') => `${API_URL}/auth/${provider}`,
};

/** Mascara visual enquanto digita: 123.456.789-01 */
export const formatCpf = (v: string) =>
  v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
