import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true, // ngrok / cloudflared
    // front chama /auth e /sso relativos, vite repassa pro Nest.
    // Excecao: /auth/callback e rota do React (onde o backend devolve o usuario).
    proxy: {
      '^/auth/(?!callback)': 'http://localhost:3000',
      '/sso': 'http://localhost:3000',
    },
  },
});
