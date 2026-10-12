import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import Login from './pages/Login';
import Register from './pages/Register';
import MfaVerify from './pages/MfaVerify';
import MfaSetup from './pages/MfaSetup';
import SocialCallback from './pages/SocialCallback';
import SsoLogin from './pages/SsoLogin';
import Dashboard from './pages/Dashboard';

function Private({ children }: { children: React.ReactElement }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/mfa" element={<MfaVerify />} />
          <Route path="/sso" element={<SsoLogin />} />
          <Route path="/auth/callback" element={<SocialCallback />} />
          <Route path="/mfa/setup" element={<Private><MfaSetup /></Private>} />
          <Route path="/" element={<Private><Dashboard /></Private>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
