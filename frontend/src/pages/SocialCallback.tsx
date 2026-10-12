import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';

/** Backend redireciona pra ca com ?accessToken=... ou ?mfaToken=... */
export default function SocialCallback() {
  const [params] = useSearchParams();
  const { handlePrimaryResult } = useAuth();

  useEffect(() => {
    const accessToken = params.get('accessToken');
    const mfaToken = params.get('mfaToken');
    if (mfaToken) handlePrimaryResult({ mfaRequired: true, mfaToken });
    else if (accessToken) handlePrimaryResult({ mfaRequired: false, accessToken });
    else window.location.replace('/login');
  }, []);

  return <p>Autenticando...</p>;
}
