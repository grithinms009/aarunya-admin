import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/* /api and /uploads are proxied to the backend so the admin and the API share an origin
   in development: the session cookie is first-party, no CORS preflight is involved, and
   uploaded photos load from the same place they were saved.
   Point VITE_API_BASE at an absolute URL to run against a deployed API instead. */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY ?? 'http://localhost:4000',
        changeOrigin: false,
      },
      '/uploads': {
        target: process.env.VITE_API_PROXY ?? 'http://localhost:4000',
        changeOrigin: false,
      },
    },
  },
});
