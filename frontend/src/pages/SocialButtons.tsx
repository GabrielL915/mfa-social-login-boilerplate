import { api } from '../lib/api';

type Provider = 'google' | 'microsoft' | 'apple';
const LABELS: Record<Provider, string> = {
  google: 'Continuar com Google',
  microsoft: 'Continuar com Microsoft',
  apple: 'Continuar com Apple',
};

/** Quais botoes aparecem: VITE_SOCIAL_PROVIDERS=google,microsoft (Apple fica de fora ate ter conta paga). */
const ENABLED = ((import.meta.env.VITE_SOCIAL_PROVIDERS as string | undefined) ?? 'google,microsoft')
  .split(',')
  .map((p) => p.trim())
  .filter((p): p is Provider => p in LABELS);

/** Login social e so redirect: o backend cuida do OAuth e volta em /auth/callback. */
export default function SocialButtons() {
  if (!ENABLED.length) return null;
  const go = (p: Provider) => () => {
    window.location.href = api.socialUrl(p);
  };
  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
      {ENABLED.map((p) => (
        <button key={p} onClick={go(p)}>{LABELS[p]}</button>
      ))}
    </div>
  );
}
