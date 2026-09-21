import { useEffect, useId, useState } from 'react';
import type { ParticipantView } from '../api/types';
import { CONTROL_H, FOCUS_RING } from './controls';

/**
 * Il prezzo di partenza: uno, l'offerta minima, non il tetto.
 *
 * <p>Il tetto e' il punto oltre il quale NON conviene, non il prezzo a cui si
 * aggiudica: proporlo nel campo significava suggerire di pagare sempre il
 * massimo consentito, e un invio distratto registrava il tetto al posto del
 * prezzo vero — che a un'asta, per i giocatori che nessuno contende, e' quasi
 * sempre uno. Il tetto resta grande e in evidenza nella scheda, che e' il suo
 * posto: un numero da consultare, non un valore precompilato.
 */
const STARTING_PRICE = 1;

export function BidPanel({
  participants,
  disabled,
  pending,
  error,
  onAssign,
}: {
  participants: ParticipantView[];
  disabled: boolean;
  pending: boolean;
  error: string | null;
  onAssign: (input: { participantId: string; price: number }) => void;
}) {
  const priceId = useId();
  const buyerId = useId();
  const errorId = useId();
  const hintId = useId();

  // Nessuna risincronizzazione con una proposta che cambia: il campo parte da
  // uno e da li' si muove solo se lo muove l'utente. Cambiando giocatore e'
  // la route a rimontare il pannello (key sul playerId), e il campo riparte da
  // uno per il lotto nuovo.
  const [price, setPrice] = useState(STARTING_PRICE);

  const [participantId, setParticipantId] = useState(
    participants.find((p) => p.me)?.id ?? participants[0]?.id ?? '',
  );

  // La route (Task 17) monta questo pannello con participants=[] finche' la
  // query dei partecipanti non risolve: il calcolo qui sopra, eseguito una
  // sola volta al mount, produce sempre ''. Senza risincronizzarlo quando la
  // lista arriva, il <select> del browser mostrerebbe comunque la prima
  // opzione (sembra scelto) mentre lo stato resta vuoto — e un invio senza
  // toccare il menu, il percorso piu' comune, scriverebbe participantId: ''
  // nel registro d'aggiudicazione. Si risincronizza solo quando la scelta
  // attuale non e' (piu') fra i partecipanti: una scelta ancora valida
  // dell'utente non va cancellata da un refetch che ridisegna lo stesso
  // elenco con un nuovo riferimento d'array.
  useEffect(() => {
    setParticipantId((current) => {
      if (participants.some((p) => p.id === current)) return current;
      return participants.find((p) => p.me)?.id ?? participants[0]?.id ?? '';
    });
  }, [participants]);

  // Un bottone disabilitato e' annunciato come "non disponibile" e basta: chi
  // vede lo deduce dal bordo tratteggiato della scheda o da "Connessione
  // persa" in testata, chi ascolta no. Le due ragioni non sono la stessa
  // situazione: l'attesa si scioglie da sola in decine di millisecondi, lo
  // stantio no — richiede che il dato torni fresco, non che il tempo passi.
  const disabledReason = pending
    ? 'Invio in corso: attendi la conferma.'
    : disabled
      ? 'Aggiudica non disponibile: i valori mostrati non sono aggiornati.'
      : null;

  return (
    // Etichette ACCANTO ai campi, non sopra, e riga allineata al centro: con le
    // etichette in cima le scatole partivano da quote diverse e, allineando per
    // il fondo, campo e menu sporgevano sopra il bottone. Tutti i controlli
    // condividono CONTROL_H — l'enfasi la porta il colore, mai l'altezza.
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onAssign({ participantId, price });
      }}
    >
      <label htmlFor={priceId} className="text-sm text-muted-foreground">
        Prezzo
      </label>
      <input
        id={priceId}
        type="number"
        min={1}
        value={price}
        onChange={(e) => setPrice(Number(e.target.value))}
        aria-invalid={error !== null}
        aria-describedby={error ? errorId : undefined}
        className={`tnum ${CONTROL_H} w-24 rounded-full border border-line-strong bg-transparent px-4 font-bold ${FOCUS_RING}`}
      />

      <label htmlFor={buyerId} className="ml-2 text-sm text-muted-foreground">
        Aggiudica a
      </label>
      <select
        id={buyerId}
        value={participantId}
        onChange={(e) => setParticipantId(e.target.value)}
        className={`${CONTROL_H} rounded-full border border-line-strong bg-transparent px-4 font-bold ${FOCUS_RING}`}
      >
        {participants.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {/* Il verbo del bottone e' lo stesso dell'esito: si preme Aggiudica e
          l'evento registrato e' un'aggiudicazione.

          Di contorno, non pieno: l'oro e' passato a «Avvia il conto alla
          rovescia», che e' il gesto con cui si batte un lotto conteso. Questa
          resta la via diretta per un giocatore che nessuno contende — a portata
          di mano, ma non e' lei a guidare la scheda. */}
      <button
        type="submit"
        disabled={disabled || pending}
        aria-describedby={disabledReason ? hintId : undefined}
        className={`${CONTROL_H} ml-2 rounded-full border border-line-strong px-6 font-bold transition-opacity duration-200 hover:bg-line disabled:opacity-50 ${FOCUS_RING}`}
      >
        {pending ? 'Aggiudico…' : 'Aggiudica'}
      </button>
      {disabledReason ? (
        // Statico, non una live region: la pagina ne ha una sola
        // (AuctionAnnouncer, Task 16) e una seconda competerebbe con quella.
        <span id={hintId} className="sr-only">
          {disabledReason}
        </span>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="w-full text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
