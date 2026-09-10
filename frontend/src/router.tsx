import { createBrowserRouter, RouterProvider } from 'react-router-dom';
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
const router = createBrowserRouter([
  { path: '/', element: <HomeRoute /> },
  { path: '/asta', element: <AuctionRoute /> },
  { path: '/proiezione', element: <ProjectionRoute /> },
  { path: '/impostazioni', element: <SettingsRoute /> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
