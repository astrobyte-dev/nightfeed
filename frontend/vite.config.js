import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';

const useHttps = process.env.VITE_HTTPS === 'true';

export default defineConfig({
  plugins: [react(), useHttps && mkcert()].filter(Boolean),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true
      }
    }
  }
});
