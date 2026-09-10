import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AuctionRoute } from './routes/AuctionRoute';
import { ProjectionRoute } from './routes/ProjectionRoute';

// La proiezione ha una URL propria perche' va aperta in una seconda finestra, sul
// secondo schermo: senza un indirizzo non c'e' niente da trascinare sul proiettore.
const router = createBrowserRouter([
  { path: '/', element: <AuctionRoute /> },
  { path: '/proiezione', element: <ProjectionRoute /> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
