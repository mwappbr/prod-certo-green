import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { PORT } from '../scripts/dev-platform-config.mjs';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': `http://localhost:${PORT}`,
    },
  },
});
