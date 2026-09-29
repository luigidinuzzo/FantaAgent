import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:5173' },
  // Il backend NON viene avviato da qui: va gia' in esecuzione, su un database di
  // prova (FANTAAGENT_DB_DIR=$(mktemp -d) ./run.sh). E' una precondizione
  // dichiarata, non una dimenticanza: la prova crea utenti, leghe e aste veri, e
  // avviarlo da qui rischierebbe di farlo sul database di tutti i giorni.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
