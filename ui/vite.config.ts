import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { jarvisBackendPlugin } from './vite-plugin-jarvis';
import jarvisConfig from '../config.json';

export default defineConfig({
  base: './',
  plugins: [react(), jarvisBackendPlugin()],
  resolve: {
    preserveSymlinks: true,
  },
  server: {
    port: 5173,
    host: true,
    fs: { allow: ['..'] },
    proxy: {
      '/api': {
        target: jarvisConfig.localAgent.localHttpUrl,
        changeOrigin: true,
      },
      '/ws': {
        target: jarvisConfig.localAgent.localHttpUrl.replace(/^http/, 'ws'),
        ws: true,
      },
    },
  },
});
