export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type PrimaryAuthResult =
  | { mfaRequired: true; mfaToken: string }
  | { mfaRequired: false; accessToken: string };

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
  if (!res.ok) throw new Error(data.message ?? 'Erro na requisicao');
  return data as T;
}

export const api = {
  register: (email: string, password: string, name: string) =>
    request<PrimaryAuthResult>('/auth/register', { email, password, name }),
  login: (email: string, password: string) =>
    request<PrimaryAuthResult>('/auth/login', { email, password }),
  mfaVerify: (mfaToken: string, code: string) =>
    request<{ accessToken: string }>('/auth/mfa/verify', { mfaToken, code }),
  me: (token: string) => request<any>('/auth/me', undefined, token),
  mfaSetup: (token: string) =>
    request<{ secret: string; otpauth: string; qrDataUrl: string }>('/auth/mfa/setup', {}, token),
  mfaEnable: (token: string, code: string) =>
    request<{ recoveryCodes: string[]; accessToken: string }>('/auth/mfa/enable', { code }, token),
  mfaDisable: (token: string, code: string) =>
    request<{ ok: true }>('/auth/mfa/disable', { code }, token),
  socialUrl: (provider: 'google' | 'microsoft' | 'apple') => `${API_URL}/auth/${provider}`,
};
