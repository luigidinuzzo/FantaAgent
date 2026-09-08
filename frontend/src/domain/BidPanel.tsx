import { useEffect, useId, useState } from 'react';
import type { ParticipantView } from '../api/types';

export function BidPanel({
  suggestedPrice,
  participants,
  disabled,
  pending,
  error,
  onAssign,
}: {
  suggestedPrice: number;
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

  const [price, setPrice] = useState(suggestedPrice);
  const [touched, setTouched] = useState(false);

  // Cambiando giocatore il prezzo deve tornare al tetto di QUEL giocatore. Ma
  // useValuation (Task 11) rivaluta ogni 5 s anche il giocatore GIA'
  // selezionato: un'offerta altrui sposta i budget e quindi il tetto puo'
  // ricalcolarsi pur restando lo stesso giocatore, e da qui (nessun playerId
  // da confrontare) le due situazioni sono indistinguibili. "touched" e'
  // esplicito, non dedotto per coincidenza numerica: confrontare il prezzo
  // con l'ultimo suggerito avrebbe scambiato per "intatto" un prezzo che
  // l'utente ha ridigitato uguale a quello precedente — correggendo un
  // refuso, per esempio — un caso reale, non solo teorico.
  useEffect(() => {
    if (!touched) setPrice(suggestedPrice);
  }, [suggestedPrice, touched]);

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
    ? 'Invio in corso: attendi la conferma del server.'
    : disabled
      ? 'Aggiudica non disponibile: i valori mostrati non sono aggiornati.'
      : null;

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onAssign({ participantId, price });
      }}
    >
      <div>
        <label htmlFor={priceId} className="block text-sm text-muted-foreground">
          Prezzo
        </label>
        <input
          id={priceId}
          type="number"
          min={1}
          value={price}
          onChange={(e) => {
            setTouched(true);
            setPrice(Number(e.target.value));
          }}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          className="tnum mt-1 min-h-11 w-24 border border-line-strong bg-transparent px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        />
      </div>

      <div>
        <label htmlFor={buyerId} className="block text-sm text-muted-foreground">
          Aggiudica a
        </label>
        <select
          id={buyerId}
          value={participantId}
          onChange={(e) => setParticipantId(e.target.value)}
          className="mt-1 min-h-11 border border-line bg-transparent px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Il verbo del bottone e' lo stesso dell'esito: si preme Aggiudica e
          l'evento registrato e' un'aggiudicazione. */}
      <button
        type="submit"
        disabled={disabled || pending}
        aria-describedby={disabledReason ? hintId : undefined}
        className="min-h-11 bg-accent px-5 font-bold text-on-accent transition-opacity duration-200 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground"
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
