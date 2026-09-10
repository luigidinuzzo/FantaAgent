import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AuctionRoute } from './routes/AuctionRoute';
import { HomeRoute } from './routes/HomeRoute';
import { ProjectionRoute } from './routes/ProjectionRoute';

// La proiezione ha una URL propria perche' va aperta in una seconda finestra, sul
// secondo schermo: senza un indirizzo non c'e' niente da trascinare sul proiettore.
//
// La home prende la radice perche' e' da li' che si comincia, ed e' l'indirizzo
// che si digita a mente la sera dell'asta: l'asta in corso si sposta su /asta.
const router = createBrowserRouter([
  { path: '/', element: <HomeRoute /> },
  { path: '/asta', element: <AuctionRoute /> },
  { path: '/proiezione', element: <ProjectionRoute /> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
