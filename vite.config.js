import { defineConfig } from 'vite';
export default defineConfig({
  base: '/top-down/',
  build: { target: 'es2020', chunkSizeWarningLimit: 1200 },
  server: { host: '127.0.0.1', port: 5173 },
});
