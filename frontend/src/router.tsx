import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AppFrame } from './AppFrame';
import { AuctionRoute } from './routes/AuctionRoute';
import { ForgotPasswordRoute } from './routes/ForgotPasswordRoute';
import { HomeRoute } from './routes/HomeRoute';
import { LoginRoute } from './routes/LoginRoute';
import { ProfileRoute } from './routes/ProfileRoute';
import { ProjectionRoute } from './routes/ProjectionRoute';
import { RegisterRoute } from './routes/RegisterRoute';
import { RequireAuth } from './routes/RequireAuth';
import { ResetPasswordRoute } from './routes/ResetPasswordRoute';
import { SettingsRoute } from './routes/SettingsRoute';
import { VerifyEmailRoute } from './routes/VerifyEmailRoute';

// La proiezione ha una URL propria perche' va aperta in una seconda finestra, sul
// secondo schermo: senza un indirizzo non c'e' niente da trascinare sul proiettore.
//
// La home prende la radice perche' e' da li' che si comincia, ed e' l'indirizzo
// che si digita a mente la sera dell'asta: l'asta in corso si sposta su /asta.
//
// Le impostazioni hanno un indirizzo proprio perche' e' dove un'asta nasce: la home
// (Task 9) ci porta con un link, senza creare niente da sola.
//
// Esportato (non solo passato a createBrowserRouter) perche' SpaRoutesControllerTest
// lo legge dal sorgente e pretende che l'elenco delle rotte del client coincida con
// quelle che il server inoltra a index.html.
export const routeDefinitions = [
  { path: '/', element: <RequireAuth><HomeRoute /></RequireAuth> },
  { path: '/asta', element: <RequireAuth><AuctionRoute /></RequireAuth> },
  { path: '/proiezione', element: <RequireAuth><ProjectionRoute /></RequireAuth> },
  { path: '/impostazioni', element: <RequireAuth><SettingsRoute /></RequireAuth> },
  { path: '/profilo', element: <RequireAuth><ProfileRoute /></RequireAuth> },
  // Le pagine d'ingresso: pubbliche, senza la barra delle altre.
  { path: '/accedi', element: <LoginRoute /> },
  { path: '/registrati', element: <RegisterRoute /> },
  { path: '/password-dimenticata', element: <ForgotPasswordRoute /> },
  { path: '/nuova-password', element: <ResetPasswordRoute /> },
  { path: '/verifica-email', element: <VerifyEmailRoute /> },
  // Non una destinazione: un indirizzo che ha funzionato, e che deve continuare a
  // portare da qualche parte. Il riepilogo ora vive DENTRO /asta, nella scheda
  // "Rose squadre".
  //
  // La `path` resta dichiarata qui apposta: SpaRoutesControllerTest legge questo file
  // con l'espressione path:\s*'([^']+)' e pretende che l'elenco coincida con
  // SpaRoutesController.ROUTES. Togliere la riga farebbe fallire quel test e — peggio —
  // un ricaricamento profondo su /riepilogo darebbe 404 invece del reindirizzamento,
  // perche' il server non inoltrerebbe piu' index.html.
  { path: '/riepilogo', element: <Navigate to="/asta" replace /> },
];

// Tutte dentro AppFrame: campo e fondo restano montati fra una pagina e l'altra, e
// a cambiare e' solo il contenuto.
const router = createBrowserRouter([{ element: <AppFrame />, children: routeDefinitions }]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
