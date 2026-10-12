import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

/** Ativacao do MFA (usuario ja logado): mostra QR, confirma com codigo, exibe recovery codes. */
export default function MfaSetup() {
  const { token, setToken } = useAuth();
  const navigate = useNavigate();
  const [setup, setSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.mfaSetup(token!).then(setSetup).catch((e) => setError(e.message));
  }, []);

  async function confirm(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const r = await api.mfaEnable(token!, code.trim());
      setToken(r.accessToken);
      setRecovery(r.recoveryCodes);
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (recovery) {
    return (
      <div style={{ maxWidth: 420, margin: '80px auto', fontFamily: 'sans-serif' }}>
        <h1>MFA ativado</h1>
        <p>Guarde estes codigos de recuperacao. Cada um funciona uma vez.</p>
        <pre>{recovery.join('\n')}</pre>
        <button onClick={() => navigate('/')}>Concluir</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 420, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>Ativar MFA</h1>
      {setup ? (
        <>
          <p>Escaneie no Google Authenticator / Authy / 1Password:</p>
          <img src={setup.qrDataUrl} alt="QR Code" />
          <p>
            Ou digite a chave: <code>{setup.secret}</code>
          </p>
          <form onSubmit={confirm} style={{ display: 'grid', gap: 8 }}>
            <input placeholder="Codigo de 6 digitos" value={code} onChange={(e) => setCode(e.target.value)} />
            <button type="submit">Confirmar e ativar</button>
          </form>
        </>
      ) : (
        <p>Carregando...</p>
      )}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
