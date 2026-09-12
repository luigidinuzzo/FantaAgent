import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from './client';
import type { PlayerSummary, Role } from './types';

/**
 * Quanto si aspetta che le dita si fermino. Durante un'asta si digitano tre lettere
 * e si guarda il primo risultato: 200 ms e' sotto la soglia in cui l'attesa si nota,
 * e sopra la cadenza con cui si preme un tasto dopo l'altro.
 */
export const SEARCH_DEBOUNCE_MS = 200;

/**
 * L'attesa parte anche per il primo valore, non solo per i cambiamenti successivi:
 * {@code useState(value)} inizializzerebbe {@code settled} gia' uguale a
 * {@code value} al primo render, rendendo la ricerca subito abilitata prima ancora
 * che la prima lettera abbia avuto un'attesa — esattamente il montaggio diretto su
 * una query non vuota che il test della digitazione verifica. Inizializzare a un
 * valore neutro (qui, la stringa vuota) e lasciare che sia SEMPRE l'effetto a
 * scrivere il valore vero mantiene l'attesa identica al primo giro e a tutti i
 * successivi.
 */
function useDebounced(value: string, delayMs: number): string {
  const [settled, setSettled] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return settled;
}

/**
 * La ricerca per nome, con il filtro di ruolo del mockup.
 *
 * <p>La guardia sull'ordine delle risposte non e' scritta a mano: la chiave di query
 * CONTIENE la domanda, quindi una risposta per "mar" non puo' finire nella casella di
 * "martinez" nemmeno arrivando dopo. E' lo stesso motivo per cui in questo progetto la
 * cache e' la risposta del server e mai una previsione — ma vale la pena dirlo, perche'
 * la versione scritta a mano di questa guardia (un contatore di richieste, un ref
 * all'ultima) e' il primo posto in cui si sbaglia.
 *
 * <p>Non restituisce valutazioni: l'endpoint non le calcola, e calcolarne otto a ogni
 * tasto premuto costerebbe un centinaio di millisecondi per numeri che chi cerca non
 * sta ancora guardando. Si sceglie un risultato, e la valutazione arriva da
 * useValuation.
 */
export function usePlayerSearch(query: string, role: Role | null) {
  const settled = useDebounced(query.trim(), SEARCH_DEBOUNCE_MS);
  return useQuery({
    queryKey: ['player-search', settled, role] as const,
    queryFn: () => {
      const params = new URLSearchParams({ q: settled });
      if (role) params.set('role', role);
      return apiGet<PlayerSummary[]>(`/players?${params.toString()}`);
    },
    enabled: settled.length > 0,
  });
}
