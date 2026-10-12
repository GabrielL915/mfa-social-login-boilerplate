import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, formatCpf } from '../lib/api';
import { useAuth } from '../lib/auth';

/**
 * Usuario entrou por Google/Microsoft/Apple/SSO e ainda nao tem CPF.
 * Se o CPF ja pertence a outra conta, pede a senha dela pra vincular.
 */
export default function CompleteProfile() {
  const { handlePrimaryResult } = useAuth();
  const navigate = useNavigate();
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [needsLink, setNeedsLink] = useState(false);
  const [error, setError] = useState('');

  const profileToken = sessionStorage.getItem('profileToken');
  if (!profileToken) {
    navigate('/login');
    return null;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const r = needsLink
        ? await api.profileLink(profileToken!, cpf, password)
        : await api.profileComplete(profileToken!, cpf);
      sessionStorage.removeItem('profileToken');
      handlePrimaryResult(r);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 409 && err.body?.code === 'CPF_IN_USE') {
        if (err.body.canLink) {
          setNeedsLink(true);
          setError('');
        } else {
          setError('Este CPF ja tem conta sem senha. Entre por ela ou fale com o suporte.');
        }
        return;
      }
      setError(err.message);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>Complete seu cadastro</h1>
      <p>Pra continuar, informe seu CPF.</p>
      <form onSubmit={submit} style={{ display: 'grid', gap: 8 }}>
        <input
          autoFocus
          inputMode="numeric"
          placeholder="000.000.000-00"
          value={cpf}
          onChange={(e) => setCpf(formatCpf(e.target.value))}
          disabled={needsLink}
        />
        {needsLink && (
          <>
            <p style={{ margin: 0 }}>
              Este CPF ja tem conta. Digite a senha dela pra vincular seu login social.
            </p>
            <input
              autoFocus
              type="password"
              placeholder="Senha da conta existente"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </>
        )}
        <button type="submit">{needsLink ? 'Vincular e entrar' : 'Continuar'}</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
