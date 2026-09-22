import { useEffect, useId, useState } from 'react';
import type { ParticipantView, Role } from '../api/types';
import { maxAffordable, roleFull } from './bidRules';
import { CONTROL_H, FOCUS_RING } from './controls';
import { ROLE_NAME_PLURAL } from './roles';

/**
 * L'aggiudicazione diretta: prezzo e squadra, senza conto alla rovescia. E' la via
 * per un giocatore che nessuno contende, o per registrare un'asta fatta a voce.
 *
 * <p><b>Niente e' precompilato.</b> Prima il prezzo partiva da uno e l'acquirente
 * era la propria squadra: un «Aggiudica» premuto per sbaglio registrava un acquisto
 * vero, a te, per un credito. Ora il prezzo parte vuoto, la squadra va scelta, e il
 * bottone resta spento finche' mancano. Il tetto non si propone mai come prezzo: e'
 * il punto oltre cui non conviene, non il prezzo a cui si aggiudica.
 *
 * <p>Se la squadra scelta non puo' permettersi quel prezzo — crediti meno uno per
 * ogni altro posto da riempire — o ha gia' pieni i posti del ruolo, lo dice prima
 * dell'invio: il server rifiuterebbe comunque.
 */
export function BidPanel({
  participants,
  role,
  disabled,
  pending,
  error,
  onAssign,
}: {
  participants: ParticipantView[];
  /** Il ruolo del giocatore: serve a dire se una squadra ha gia' pieni quei posti. */
  role?: Role;
  disabled: boolean;
  pending: boolean;
  error: string | null;
  onAssign: (input: { participantId: string; price: number }) => void;
}) {
  const priceId = useId();
  const buyerId = useId();
  const errorId = useId();
  const hintId = useId();

  // Una stringa, non un numero: il campo vuoto e' uno stato vero («non ancora
  // scritto»), e un numero obbligherebbe a decidere cosa vale.
  const [price, setPrice] = useState('');
  const [participantId, setParticipantId] = useState('');

  // Se la squadra scelta sparisce dall'elenco (un refetch che la toglie), la scelta
  // si azzera invece di restare su un id che non esiste piu'. Un refetch con lo
  // stesso elenco non tocca niente.
  useEffect(() => {
    setParticipantId((current) => (participants.some((p) => p.id === current) ? current : ''));
  }, [participants]);

  const amount = Number(price);
  const validPrice = price !== '' && Number.isInteger(amount) && amount >= 1;
  const buyer = participants.find((p) => p.id === participantId) ?? null;
  const full = buyer !== null && role !== undefined && roleFull(buyer, role);
  const tooMuch = buyer !== null && validPrice && maxAffordable(buyer) < amount;

  const disabledReason = pending
    ? 'Invio in corso: attendi la conferma.'
    : disabled
      ? 'Aggiudica non disponibile: i valori mostrati non sono aggiornati.'
      : null;

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!validPrice || !participantId) return;
        onAssign({ participantId, price: amount });
      }}
    >
      <label htmlFor={priceId} className="text-sm text-muted-foreground">
        Prezzo
      </label>
      <input
        id={priceId}
        type="number"
        min={1}
        step={1}
        inputMode="numeric"
        required
        placeholder="—"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        aria-invalid={error !== null}
        aria-describedby={error ? errorId : undefined}
        className={`tnum ${CONTROL_H} w-24 rounded-full border border-line-strong bg-transparent px-4 font-bold placeholder:text-muted-foreground ${FOCUS_RING}`}
      />

      <label htmlFor={buyerId} className="ml-2 text-sm text-muted-foreground">
        Aggiudica a
      </label>
      <select
        id={buyerId}
        value={participantId}
        required
        onChange={(e) => setParticipantId(e.target.value)}
        className={`${CONTROL_H} min-w-0 rounded-full border border-line-strong bg-surface px-4 font-bold ${FOCUS_RING}`}
      >
        <option value="" disabled>Scegli la squadra</option>
        {participants.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <button
        type="submit"
        disabled={disabled || pending || !validPrice || !participantId}
        aria-describedby={disabledReason ? hintId : undefined}
        className={`${CONTROL_H} ml-2 rounded-full border border-line-strong px-6 font-bold transition-opacity duration-200 hover:bg-line disabled:opacity-50 ${FOCUS_RING}`}
      >
        {pending ? 'Aggiudico…' : 'Aggiudica'}
      </button>
      {disabledReason ? (
        <span id={hintId} className="sr-only">
          {disabledReason}
        </span>
      ) : null}

      {buyer && (full || tooMuch) ? (
        <p className="w-full text-sm font-bold text-destructive">
          {full && role
            ? `${buyer.name} ha già tutti i posti ${ROLE_NAME_PLURAL[role]}.`
            : `${buyer.name} può offrire al massimo ${Math.max(0, maxAffordable(buyer))}.`}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="w-full text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
