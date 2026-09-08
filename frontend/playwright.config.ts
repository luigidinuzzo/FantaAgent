import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:5173' },
  // Il backend NON viene avviato da qui: va gia' in esecuzione, con un'asta
  // aperta. E' una precondizione dichiarata, non un dimenticanza — avviarlo
  // dentro Playwright significherebbe creare aste vere a ogni esecuzione.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
