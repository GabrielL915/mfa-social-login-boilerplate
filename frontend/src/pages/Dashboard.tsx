import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Dashboard() {
  const { token, logout } = useAuth();
  const [me, setMe] = useState<any>(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.me(token!).then(setMe).catch(logout);
  }, []);

  async function disable() {
    try {
      await api.mfaDisable(token!, code);
      setMsg('MFA desativado');
      setMe({ ...me, mfaEnabled: false });
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  if (!me) return <p>Carregando...</p>;

  return (
    <div style={{ maxWidth: 420, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>Ola, {me.name ?? me.email}</h1>
      <p>CPF: {me.cpf}</p>
      <p>Provider: {me.provider}</p>
      <p>MFA: {me.mfaEnabled ? 'ativo' : 'inativo'}</p>
      {me.mfaEnabled ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <input placeholder="Codigo TOTP p/ desativar" value={code} onChange={(e) => setCode(e.target.value)} />
          <button onClick={disable}>Desativar MFA</button>
        </div>
      ) : (
        <Link to="/mfa/setup">Ativar MFA</Link>
      )}
      {msg && <p>{msg}</p>}
      <br />
      <button onClick={logout}>Sair</button>
    </div>
  );
}
