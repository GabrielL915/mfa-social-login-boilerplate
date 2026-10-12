/**
 * Bypass de DESENVOLVIMENTO pra testar o funil sem autenticador/IdP real.
 *   DEV_AUTH_BYPASS=true  -> MFA aceita o codigo 000000; SSO aceita qualquer dominio via IdP fake.
 * Nunca liga em producao: assertDevBypassSafe() derruba o boot se NODE_ENV=production.
 */
export const DEV_MFA_CODE = '000000';

export function devBypassEnabled() {
  return process.env.DEV_AUTH_BYPASS === 'true' && process.env.NODE_ENV !== 'production';
}

export function assertDevBypassSafe() {
  if (process.env.DEV_AUTH_BYPASS === 'true' && process.env.NODE_ENV === 'production') {
    throw new Error('DEV_AUTH_BYPASS=true com NODE_ENV=production. Recusando subir.');
  }
  if (devBypassEnabled()) {
    // eslint-disable-next-line no-console
    console.warn('\n  *** DEV_AUTH_BYPASS ATIVO: MFA aceita 000000 e SSO aceita qualquer dominio. So pra dev. ***\n');
  }
}
