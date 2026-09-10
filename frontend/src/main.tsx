import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryProvider } from './api/QueryProvider';
import { setAuctionContext } from './api/client';
import './index.css';
import { AppRouter } from './router';

// In questo sotto-progetto la lega e' una sola e l'asta e' quella aperta sul
// server. Il sotto-progetto 3 le prendera' dalla sessione dell'utente.
setAuctionContext({
  leagueId: import.meta.env.VITE_LEAGUE_ID ?? 'default',
  auctionId: import.meta.env.VITE_AUCTION_ID ?? 'corrente',
});

document.documentElement.classList.add('dark');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <AppRouter />
    </QueryProvider>
  </StrictMode>,
);
