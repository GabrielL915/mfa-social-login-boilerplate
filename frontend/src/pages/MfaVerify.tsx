import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

/** 2o passo do login: usuario digita TOTP do app autenticador (ou recovery code). */
export default function MfaVerify() {
  const { setToken } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const mfaToken = sessionStorage.getItem('mfaToken');
    if (!mfaToken) return navigate('/login');
    try {
      const { accessToken } = await api.mfaVerify(mfaToken, code.trim());
      sessionStorage.removeItem('mfaToken');
      setToken(accessToken);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>Verificacao em duas etapas</h1>
      <p>Digite o codigo do seu app autenticador ou um codigo de recuperacao.</p>
      <form onSubmit={submit} style={{ display: 'grid', gap: 8 }}>
        <input autoFocus placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} />
        <button type="submit">Confirmar</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
