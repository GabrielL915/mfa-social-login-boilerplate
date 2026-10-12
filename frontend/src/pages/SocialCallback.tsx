import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';

/** Backend redireciona pra ca com ?accessToken= | ?mfaToken= | ?profileToken= */
export default function SocialCallback() {
  const [params] = useSearchParams();
  const { handlePrimaryResult } = useAuth();

  useEffect(() => {
    const accessToken = params.get('accessToken');
    const mfaToken = params.get('mfaToken');
    const profileToken = params.get('profileToken');
    if (profileToken) handlePrimaryResult({ step: 'profile', profileToken });
    else if (mfaToken) handlePrimaryResult({ step: 'mfa', mfaToken });
    else if (accessToken) handlePrimaryResult({ step: 'done', accessToken });
    else window.location.replace('/login');
  }, []);

  return <p>Autenticando...</p>;
}
