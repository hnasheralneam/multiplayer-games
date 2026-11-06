import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendPort = process.env.PORT ?? '3000';
const devPort = Number(process.env.DEV_PORT ?? 5173);

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: devPort,
    strictPort: true,
    proxy: {
      '/api': `http://localhost:${backendPort}`,
      '/ws': {
        target: `ws://localhost:${backendPort}`,
        ws: true
      }
    }
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true
  }
});
