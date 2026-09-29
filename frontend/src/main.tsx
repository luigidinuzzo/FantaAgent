import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryProvider } from './api/QueryProvider';
import './index.css';
import { AppRouter } from './router';

document.documentElement.classList.add('dark');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <AppRouter />
    </QueryProvider>
  </StrictMode>,
);
