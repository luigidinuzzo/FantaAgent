import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  // Il backend resta l'origine dei dati anche in sviluppo: nessun mock, nessuna
  // seconda verita' da tenere allineata.
  server: { proxy: { '/api': 'http://localhost:8080' } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: true,
    // e2e/ e' Playwright, non Vitest: stessa estensione ".spec.ts", motore
    // diverso. Senza l'esclusione, vitest lo importerebbe e basterebbe la
    // sola chiamata a test() di Playwright per far fallire l'intera suite.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
