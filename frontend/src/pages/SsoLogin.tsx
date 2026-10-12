import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

/** SSO corporativo: o dominio do email decide pra qual IdP mandar. */
export default function SsoLogin() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const { url } = await api.ssoStart(email);
      window.location.href = url;
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>Entrar com SSO</h1>
      <p>Use o email da sua empresa.</p>
      <form onSubmit={submit} style={{ display: 'grid', gap: 8 }}>
        <input placeholder="voce@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="submit">Continuar</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <p>
        <Link to="/login">Voltar</Link>
      </p>
    </div>
  );
}
