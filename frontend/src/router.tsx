import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AuctionRoute } from './routes/AuctionRoute';
import { HomeRoute } from './routes/HomeRoute';
import { ProjectionRoute } from './routes/ProjectionRoute';
import { SettingsRoute } from './routes/SettingsRoute';

// La proiezione ha una URL propria perche' va aperta in una seconda finestra, sul
// secondo schermo: senza un indirizzo non c'e' niente da trascinare sul proiettore.
//
// La home prende la radice perche' e' da li' che si comincia, ed e' l'indirizzo
// che si digita a mente la sera dell'asta: l'asta in corso si sposta su /asta.
//
// Le impostazioni hanno un indirizzo proprio perche' e' dove un'asta nasce: la home
// (Task 9) ci porta con un link, senza creare niente da sola.
//
// Esportato (non solo passato a createBrowserRouter) perche' AppShell.test.tsx lo
// scorre per verificare che OGNI rotta qui elencata sia raggiungibile da un link
// nella barra comune — la reazione strutturale a due revisioni consecutive che
// hanno trovato "una rotta aggiunta e nessuno che la collega".
export const routeDefinitions = [
  { path: '/', element: <HomeRoute /> },
  { path: '/asta', element: <AuctionRoute /> },
  { path: '/proiezione', element: <ProjectionRoute /> },
  { path: '/impostazioni', element: <SettingsRoute /> },
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

const router = createBrowserRouter(routeDefinitions);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
