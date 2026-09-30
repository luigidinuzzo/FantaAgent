import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { AuthLayout, PRIMARY_BUTTON } from '../domain/AuthForm';

/**
 * Cio' che si vede al posto della pagina di errore di React Router, che parla agli
 * sviluppatori ("Hey developer").
 *
 * <p>Quasi sempre e' un indirizzo che non c'e': un link o un segnalibro della versione
 * vecchia ("/asta"), o un indirizzo scritto male. Il resto e' un errore dentro una
 * schermata, e a chi usa l'app serve la stessa cosa: un modo per tornare all'inizio.
 */
export function RouteErrorRoute() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <AuthLayout title={notFound ? 'Questa pagina non c’è' : 'Qualcosa non ha funzionato'}>
      <p>
        {notFound
          ? 'L’indirizzo non corrisponde a nessuna pagina. Forse viene da un link vecchio.'
          : 'La pagina si è interrotta. Ricaricala, o torna all’inizio.'}
      </p>
      <Link to="/" className={`${PRIMARY_BUTTON} flex items-center justify-center`}>
        Vai alle tue leghe
      </Link>
    </AuthLayout>
  );
}
