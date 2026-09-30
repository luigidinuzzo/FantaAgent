import { createContext, useContext } from 'react';

/**
 * Se un indirizzo corrisponde a una pagina dell'app. Lo fornisce il router, che e'
 * l'unico a conoscere l'elenco delle rotte; chi lo usa (il ritorno dopo l'accesso)
 * non puo' importare il router senza un ciclo, perche' il router importa lui.
 *
 * <p>Fuori dal router, cioe' nei test di una schermata sola, ogni indirizzo vale.
 */
export const KnownPathContext = createContext<(path: string) => boolean>(() => true);

export function useKnownPath(): (path: string) => boolean {
  return useContext(KnownPathContext);
}
