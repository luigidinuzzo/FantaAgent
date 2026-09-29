import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AppFrame } from './AppFrame';
import { AuctionRoute } from './routes/AuctionRoute';
import { AuctionSettingsRoute } from './routes/AuctionSettingsRoute';
import { ForgotPasswordRoute } from './routes/ForgotPasswordRoute';
import { ImportRoute } from './routes/ImportRoute';
import { InviteRoute } from './routes/InviteRoute';
import { LeagueRoute } from './routes/LeagueRoute';
import { LeagueRulesRoute } from './routes/LeagueRulesRoute';
import { LeaguesRoute } from './routes/LeaguesRoute';
import { LoginRoute } from './routes/LoginRoute';
import { ProfileRoute } from './routes/ProfileRoute';
import { ProjectionRoute } from './routes/ProjectionRoute';
import { RegisterRoute } from './routes/RegisterRoute';
import { RequireAuth } from './routes/RequireAuth';
import { ResetPasswordRoute } from './routes/ResetPasswordRoute';
import { VerifyEmailRoute } from './routes/VerifyEmailRoute';
import { WithAuctionContext } from './routes/WithAuctionContext';

// La proiezione ha una URL propria perche' va aperta in una seconda finestra, sul
// secondo schermo: senza un indirizzo non c'e' niente da trascinare sul proiettore.
//
// La radice e' l'elenco delle mie leghe: e' da li' che si comincia, e ogni asta sta
// dentro la sua lega. /leghe resta come sinonimo per i link gia' mandati in giro.
//
// Esportato (non solo passato a createBrowserRouter) perche' SpaRoutesControllerTest
// lo legge dal sorgente e pretende che l'elenco delle rotte del client coincida con
// quelle che il server inoltra a index.html.
export const routeDefinitions = [
  { path: '/', element: <RequireAuth><LeaguesRoute /></RequireAuth> },
  { path: '/profilo', element: <RequireAuth><ProfileRoute /></RequireAuth> },
  { path: '/leghe', element: <Navigate to="/" replace /> },
  { path: '/leghe/:leagueId', element: <RequireAuth><LeagueRoute /></RequireAuth> },
  // Le regole con cui nasceranno le prossime aste: della lega, non di un'asta.
  { path: '/leghe/:leagueId/regole', element: <RequireAuth><LeagueRulesRoute /></RequireAuth> },
  // Solo l'amministratore vi arriva (il link sta nella pagina della lega), ma la
  // guardia vera e' lato server: un membro che forzi l'indirizzo vede il 403.
  { path: '/leghe/:leagueId/importa', element: <RequireAuth><ImportRoute /></RequireAuth> },
  // Lega e asta nell'indirizzo: e' quello che si manda nel gruppo, ed e' quello che
  // un ricaricamento deve ritrovare.
  {
    path: '/leghe/:leagueId/aste/:auctionId',
    element: <RequireAuth><WithAuctionContext><AuctionRoute /></WithAuctionContext></RequireAuth>,
  },
  {
    path: '/leghe/:leagueId/aste/:auctionId/proiezione',
    element: <RequireAuth><WithAuctionContext><ProjectionRoute /></WithAuctionContext></RequireAuth>,
  },
  {
    path: '/leghe/:leagueId/aste/:auctionId/impostazioni',
    element: <RequireAuth><AuctionSettingsRoute /></RequireAuth>,
  },
  // Pubblica: chi apre l'invito spesso non ha ancora un account.
  { path: '/invito/:token', element: <InviteRoute /> },
  // Le pagine d'ingresso: pubbliche, senza la barra delle altre.
  { path: '/accedi', element: <LoginRoute /> },
  { path: '/registrati', element: <RegisterRoute /> },
  { path: '/password-dimenticata', element: <ForgotPasswordRoute /> },
  { path: '/nuova-password', element: <ResetPasswordRoute /> },
  { path: '/verifica-email', element: <VerifyEmailRoute /> },
];

// Tutte dentro AppFrame: campo e fondo restano montati fra una pagina e l'altra, e
// a cambiare e' solo il contenuto.
const router = createBrowserRouter([{ element: <AppFrame />, children: routeDefinitions }]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
