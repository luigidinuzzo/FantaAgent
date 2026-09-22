import type { BoardColumn, BoardResponse, ParticipantView, Role } from '../api/types';
import { RoleBadge } from './RoleBadge';
import { ROLE_NAME_PLURAL, ROLES } from './roles';

/** Quanti nomi mostra ogni riquadro di ruolo prima di dire «e altri N». */
const NAMES_PER_ROLE = 3;
/** Quanti acquisti mostra la colonna degli ultimi. */
const RECENT = 5;

/**
 * Il battitore a riposo: la tua squadra e l'andamento dell'asta, invece di una
 * scatola vuota con una frase in mezzo. Fra una chiamata e l'altra e' il momento in
 * cui si pensa, e le domande sono sempre le stesse: quanto mi resta, quanti posti
 * devo ancora riempire, chi ho gia' preso, cosa e' appena andato e a quanto.
 *
 * <p>Solo dati veri, dallo stato dell'asta e dal tabellone: crediti e posti del
 * partecipante segnato come proprio, i suoi acquisti per ruolo, gli ultimi acquisti
 * di tutti in ordine di registro. La media e' crediti diviso posti liberi,
 * arrotondata per difetto — la stessa divisione che si fa a mente al tavolo.
 *
 * <p>I riquadri di ruolo hanno un'altezza fissa, tre nomi e poi «e altri N»: il
 * battitore non cambia misura man mano che la rosa si riempie.
 */
export function MyTeamSummary({ me, board }: { me: ParticipantView; board?: BoardResponse }) {
  const perSlot = me.slotsRemaining > 0 ? Math.floor(me.budgetRemaining / me.slotsRemaining) : null;
  const mine: BoardColumn | undefined = board?.columns.find((c) => c.participantId === me.id);
  const recent = (board?.columns ?? [])
    .flatMap((c) => (Object.keys(c.byRole) as Role[]).flatMap((role) =>
      c.byRole[role].map((slot) => ({ ...slot, role, buyer: c.participantName, mine: c.participantId === me.id }))))
    .sort((a, b) => b.seq - a.seq)
    .slice(0, RECENT);

  return (
    <div className="grid flex-1 gap-6 px-2 py-2 sm:px-4 xl:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="flex min-w-0 flex-col justify-center gap-6">
        <p className="text-lg font-bold">{`La tua squadra, ${me.name}`}</p>

        <dl className="grid grid-cols-3 gap-4">
          <Figure label="crediti rimasti" value={me.budgetRemaining} accent />
          <Figure label="posti liberi" value={me.slotsRemaining} />
          {/* Con la rosa piena non c'e' niente da dividere: il trattino, non uno zero
              che si leggerebbe come «non puoi spendere niente». */}
          <Figure label="media per posto" value={perSlot ?? '—'} />
        </dl>

        {/* I posti per ruolo, presi su totale, e sotto chi hai preso: nomi e prezzi.
            La lettera colorata e' per chi guarda; chi ascolta sente il nome del ruolo. */}
        <ul aria-label="Posti per ruolo" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ROLES.map((role) => {
            const filled = me.filledByRole[role] ?? 0;
            const total = me.slotsByRole[role] ?? 0;
            const full = total > 0 && filled >= total;
            const bought = mine?.byRole[role] ?? [];
            const shown = bought.slice(0, NAMES_PER_ROLE);
            return (
              <li key={role} className="flex min-h-[9.5rem] flex-col rounded-xl border border-line px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true"><RoleBadge role={role} filled={full} /></span>
                  <span className="flex flex-col leading-tight">
                    <span className="tnum text-lg font-extrabold">{`${filled} di ${total}`}</span>
                    <span className="text-xs text-muted-foreground">{ROLE_NAME_PLURAL[role]}</span>
                  </span>
                </div>
                <div className="mt-2 flex flex-col gap-1 border-t border-line pt-2 text-sm">
                  {shown.length === 0 ? (
                    <span className="text-muted-foreground">Ancora nessuno</span>
                  ) : shown.map((slot) => (
                    <span key={slot.seq} className="flex items-baseline justify-between gap-2">
                      <span className="truncate">{slot.playerName}</span>
                      <span className="tnum shrink-0 text-muted-foreground">{slot.price}</span>
                    </span>
                  ))}
                  {bought.length > NAMES_PER_ROLE ? (
                    <span className="text-xs text-muted-foreground">{`e altri ${bought.length - NAMES_PER_ROLE}`}</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Gli ultimi acquisti di tutta la lega, dal piu' recente: cosa e' appena
          andato, a chi e a quanto. Il tuo in giallo. */}
      <section aria-labelledby="recent-purchases" className="flex min-w-0 flex-col border-line xl:border-l xl:pl-6">
        <h3 id="recent-purchases" className="text-sm font-bold text-muted-foreground">Ultimi acquisti</h3>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Ancora nessun acquisto in quest'asta.</p>
        ) : (
          <ol className="mt-2 flex flex-col">
            {recent.map((p) => (
              <li key={p.seq} className="flex items-center gap-3 border-b border-line py-2 last:border-b-0">
                <span aria-hidden="true"><RoleBadge role={p.role} /></span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate font-bold">{p.playerName}</span>
                  <span className={`truncate text-xs ${p.mine ? 'text-accent' : 'text-muted-foreground'}`}>
                    {p.mine ? 'a te' : `a ${p.buyer}`}
                  </span>
                </span>
                <span className="tnum shrink-0 font-bold">
                  {`${p.price} `}
                  <span className="sr-only">crediti</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Figure({ label, value, accent = false }: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    // L'etichetta sotto il numero, come nella scheda del giocatore: prima si legge
    // la cifra, poi cosa misura. Nel DOM viene prima, cosi' chi ascolta la sente
    // prima del numero. justify-end (in colonna rovesciata vuol dire «in cima»): i
    // numeri restano sulla stessa riga anche se un'etichetta va a capo.
    <div className="flex flex-col-reverse justify-end gap-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={`tnum w-exp text-4xl font-extrabold leading-none sm:text-5xl ${accent ? 'text-accent' : ''}`}>
        {value}
      </dd>
    </div>
  );
}
