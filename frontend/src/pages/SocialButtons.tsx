import { api } from '../lib/api';

/** Login social e so redirect: o backend cuida do OAuth e volta em /auth/callback. */
export default function SocialButtons() {
  const go = (p: 'google' | 'microsoft' | 'apple') => () => {
    window.location.href = api.socialUrl(p);
  };
  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
      <button onClick={go('google')}>Continuar com Google</button>
      <button onClick={go('microsoft')}>Continuar com Microsoft</button>
      <button onClick={go('apple')}>Continuar com Apple</button>
    </div>
  );
}
