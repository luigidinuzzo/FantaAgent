import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { AppShell } from './AppShell';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppShell>
      <p>La schermata d'asta non è ancora stata costruita.</p>
    </AppShell>
  </StrictMode>,
);
