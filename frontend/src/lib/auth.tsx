import { createContext, useContext, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { PrimaryAuthResult } from './api';

interface AuthCtx {
  token: string | null;
  setToken: (t: string | null) => void;
  /** Trata o resultado do 1o fator: ou loga, ou manda pra tela de MFA. */
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
    if (r.mfaRequired) {
      sessionStorage.setItem('mfaToken', r.mfaToken);
      navigate('/mfa');
    } else {
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
