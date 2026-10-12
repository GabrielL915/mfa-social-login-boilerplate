import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true, // ngrok / cloudflared
    proxy: { '/auth': 'http://localhost:3000', '/sso': 'http://localhost:3000' }, // front chama /auth relativo, vite repassa pro Nest
  },
});
