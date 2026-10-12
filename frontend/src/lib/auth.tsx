import { createContext, useContext, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { PrimaryAuthResult } from './api';

interface AuthCtx {
  token: string | null;
  setToken: (t: string | null) => void;
  /** Trata o resultado do 1o fator: completar cadastro, MFA, ou logado. */
  handlePrimaryResult: (r: PrimaryAuthResult) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>(null!);
const KEY = 'accessToken';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem(KEY));
  const navigate = useNavigate();

  const setToken = (t: string | null) => {
    t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY);
    setTokenState(t);
  };

  const handlePrimaryResult = (r: PrimaryAuthResult) => {
    switch (r.step) {
      case 'profile':
        sessionStorage.setItem('profileToken', r.profileToken);
        navigate('/complete-profile');
        break;
      case 'mfa':
        sessionStorage.setItem('mfaToken', r.mfaToken);
        navigate('/mfa');
        break;
      case 'done':
        setToken(r.accessToken);
        navigate('/');
    }
  };

  const logout = () => {
    setToken(null);
    navigate('/login');
  };

  return <Ctx.Provider value={{ token, setToken, handlePrimaryResult, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
