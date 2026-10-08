import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0', port: 5173, strictPort: true,
    watch: { ignored: ['**/test-results/**', '**/playwright-report/**', '**/outputs/**', '**/scripts/source/**'] },
  },
  preview: { host: '0.0.0.0', port: 4173, strictPort: true },
});
