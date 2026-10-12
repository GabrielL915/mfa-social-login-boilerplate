import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatCpf } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Register() {
  const { handlePrimaryResult } = useAuth();
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      handlePrimaryResult(await api.register(cpf, email, password, name));
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>Cadastro</h1>
      <form onSubmit={submit} style={{ display: 'grid', gap: 8 }}>
        <input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
        <input inputMode="numeric" placeholder="CPF" value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} />
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Senha (min 8)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">Criar conta</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <p>
        Ja tem conta? <Link to="/login">Entrar</Link>
      </p>
    </div>
  );
}
