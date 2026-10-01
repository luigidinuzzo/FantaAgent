import type { BoardResponse, ParticipantView, Role } from '../api/types';
import { maxAffordable } from './bidRules';
import { RoleBadge } from './RoleBadge';
import { ROLE_NAME_PLURAL } from './roles';

/** Quanti acquisti mostra la colonna degli ultimi: quanti ne stanno nella sua altezza. */
const RECENT = 4;
// Quanti ne restano a vista sotto sm.
const MOBILE_RECENT = 2;

/**
 * Il banco a riposo: dove sei tu e dove sta il tavolo, invece di una scatola vuota
 * con una frase in mezzo. Fra una chiamata e l'altra e' il momento in cui si pensa,
 * e le domande sono tre: quanto posso mettere su uno, devo spingere adesso o posso
 * aspettare, cosa e' appena andato e a quanto.
 *
 * <p><b>Solo dati veri, e nessuna chiamata in piu'.</b> Tutto si ricava da quello che
 * la schermata gia' scarica: lo stato dell'asta (crediti e posti di ogni squadra), il
 * tabellone (chi ha comprato cosa) e il conto dei liberi della fase. Le medie sono
 * divisioni intere — la stessa che si fa a mente al tavolo, arrotondata per difetto.
 *
 * <p><b>Perche' la pressione sul ruolo sta qui.</b> Quante squadre cercano ancora un
 * portiere e fin dove puo' arrivare la piu' ricca fra loro e' cio' che decide se
 * alzare adesso o lasciar correre. Lo stesso dato vive gia' fra i driver dei
 * consigli, ma solo CON un giocatore sul banco: a riposo spariva proprio mentre si
 * pianifica. I due stati non convivono mai, quindi non e' una ripetizione.
 *
 * <p><b>Cosa non c'e' piu'.</b> I quattro riquadri dei posti per ruolo: le rose
 * complete stanno nella scheda «Rose squadre», che ha lo spazio per leggerle, e qui
 * sotto i ~1500px si riducevano a 98px l'uno mandando a capo «1 di 3».
 */
export function MyTeamSummary({
  me,
  participants,
  phase,
  freeInPhase,
  board,
}: {
  me: ParticipantView;
  /**
   * Tutte le squadre, te compreso: servono a contare chi cerca ancora il ruolo
   * della fase e quanto ha in mano. Opzionale — senza, il blocco della fase non
   * si rende e resta la sola prima fila.
   */
  participants?: ParticipantView[];
  /** Il ruolo in corso: e' su quello che si misura la pressione. */
  phase?: Role;
  /** Quanti giocatori liberi restano nella fase, dal totale della pagina. */
  freeInPhase?: number;
  board?: BoardResponse;
}) {
  const perSlot = me.slotsRemaining > 0 ? Math.floor(me.budgetRemaining / me.slotsRemaining) : null;
  const recent = (board?.columns ?? [])
    .flatMap((c) => (Object.keys(c.byRole) as Role[]).flatMap((role) =>
      c.byRole[role].map((slot) => ({ ...slot, role, buyer: c.participantName, mine: c.participantId === me.id }))))
    .sort((a, b) => b.seq - a.seq)
    .slice(0, RECENT);

  const others = (participants ?? []).filter((p) => p.id !== me.id);
  // La media del resto del tavolo: i loro crediti sui loro posti, non la media
  // delle loro medie — una squadra con un posto solo peserebbe come una con venti.
  const tableBudget = others.reduce((n, p) => n + p.budgetRemaining, 0);
  const tableSlots = others.reduce((n, p) => n + p.slotsRemaining, 0);
  const tablePerSlot = tableSlots > 0 ? Math.floor(tableBudget / tableSlots) : null;

  // Chi cerca ancora questo ruolo: chi ha i posti pieni non rilancera' su questo
  // lotto, e contarlo gonfierebbe la concorrenza che si vede in pagina.
  const seeking = phase ? others.filter((p) => (p.filledByRole[phase] ?? 0) < (p.slotsByRole[phase] ?? 0)) : [];
  const richest = seeking.reduce((n, p) => Math.max(n, maxAffordable(p)), 0);
  // I posti del ruolo che TUTTA la lega deve ancora riempire, te compreso: e' il
  // termine di paragone dei liberi rimasti.
  const slotsToFill = phase
    ? (participants ?? []).reduce((n, p) => n + Math.max(0, (p.slotsByRole[phase] ?? 0) - (p.filledByRole[phase] ?? 0)), 0)
    : 0;

  const showPhase = phase !== undefined && participants !== undefined && participants.length > 0;

  return (
    <div className="grid flex-1 gap-6 px-2 py-2 sm:px-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="flex min-w-0 flex-col justify-center gap-7">
        {/* Il titolo non e' qui: lo rende il pannello che ci ospita, perche' a
            riposo il titolo del pannello E' questo — «La tua squadra, Anna». Reso
            anche qui, la stessa frase comparirebbe due volte, e chi ascolta
            entrerebbe in una regione che si annuncia col proprio primo contenuto. */}
        {/* La prima fila sei tu. */}
        <dl className="grid grid-cols-3 gap-4">
          {/* L'oro va al numero su cui si decide: a riposo sono i tuoi crediti.
              Gli altri numeri restano bianchi, la gerarchia la fa la taglia. */}
          <Figure label="crediti rimasti" value={me.budgetRemaining} accent={true} />
          <Figure label="posti liberi" value={me.slotsRemaining} />
          {/* Con la rosa piena non c'e' niente da dividere: il trattino, non uno zero
              che si leggerebbe come «non puoi spendere niente». */}
          <Figure
            label="media per posto"
            value={perSlot ?? '—'}
            // La media del tavolo sotto la tua, non in una colonna sua: e' il metro
            // della tua, non una quarta misura. Da sola non direbbe niente.
            note={tablePerSlot !== null ? `il tavolo sta a ${tablePerSlot}` : undefined}
          />
        </dl>

        {/* La seconda fila e' il tavolo: quanta concorrenza c'e' su questo ruolo e
            quanta scelta resta. La riga di titolo porta il nome della fase per
            esteso, cosi' i tre numeri hanno un soggetto dichiarato invece di
            dipendere dalla pallina colorata in cima alla pagina. */}
        {showPhase ? (
          <section aria-labelledby="phase-pressure" className="border-t border-line pt-5">
            <h3 id="phase-pressure" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span aria-hidden="true"><RoleBadge role={phase} /></span>
              {`La fase: ${ROLE_NAME_PLURAL[phase]}`}
            </h3>
            <dl className="mt-4 grid grid-cols-3 gap-4">
              <Figure
                testId="seeking"
                label="squadre lo cercano"
                value={seeking.length}
                size="sm"
              />
              <Figure
                testId="richest"
                label="il più ricco arriva a"
                value={richest}
                size="sm"
              />
              <Figure
                testId="free-in-phase"
                label={`${ROLE_NAME_PLURAL[phase]} liberi`}
                value={freeInPhase ?? '—'}
                size="sm"
                note={`per ${slotsToFill} posti`}
              />
            </dl>
          </section>
        ) : null}
      </div>

      {/* Gli ultimi acquisti di tutta la lega, dal piu' recente: cosa e' appena
          andato, a chi e a quanto. Il tuo in giallo. */}
      <section aria-labelledby="recent-purchases" className="flex min-w-0 flex-col border-line lg:border-l lg:pl-6">
        <h3 id="recent-purchases" className="text-sm font-medium text-muted-foreground">Ultimi acquisti</h3>
        {/* Il registro parte dal titolo e scende: il piu' recente entra in cima e
            spinge gli altri giu'. Appoggiarlo al FONDO della colonna (mt-auto) e'
            stato provato e va tolto: apriva un vuoto fra il titolo e il primo
            acquisto — a inizio asta quasi tutta l'altezza del pannello, col titolo
            sospeso sopra il nulla. Lo spazio che avanza sta in fondo, dove si
            consuma da solo man mano che gli acquisti arrivano.

            La colonna resta in pagina anche vuota: farla comparire al primo
            acquisto restringerebbe il blocco di sinistra sotto gli occhi di chi sta
            guardando. */}
        {recent.length === 0 ? (
          <p data-testid="recent-list" className="mt-3 text-sm text-muted-foreground">
            Ancora nessun acquisto in quest'asta.
          </p>
        ) : (
          <ol data-testid="recent-list" className="mt-2 flex flex-col">
            {/* Sotto sm se ne vedono due: sul telefono, con quattro, il banco a
                riposo usciva dalla prima schermata. */}
            {recent.map((p, i) => (
              <li
                key={p.seq}
                className={`flex items-center gap-3 border-b border-line py-2 last:border-b-0 ${
                  i === MOBILE_RECENT - 1 ? 'max-sm:border-b-0' : i >= MOBILE_RECENT ? 'max-sm:hidden' : ''
                }`}
              >
                <span aria-hidden="true"><RoleBadge role={p.role} /></span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate font-medium">{p.playerName}</span>
                  <span className={`truncate text-meta ${p.mine ? 'text-accent' : 'text-muted-foreground'}`}>
                    {p.mine ? 'a te' : `a ${p.buyer}`}
                  </span>
                </span>
                <span className="tnum shrink-0 font-medium">
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

function Figure({ label, value, note, size = 'lg', testId, accent }: {
  label: string;
  value: number | string;
  /** Una riga di contesto sotto l'etichetta: il metro del numero, non un secondo numero. */
  note?: string;
  /** "lg" sono i tuoi numeri, "sm" quelli del tavolo: la gerarchia dice di chi si parla. */
  size?: 'lg' | 'sm';
  testId?: string;
  accent?: boolean;
}) {
  return (
    // L'etichetta sotto il numero, come nella scheda del giocatore: prima si legge
    // la cifra, poi cosa misura. Nel DOM viene prima, cosi' chi ascolta la sente
    // prima del numero. justify-end (in colonna rovesciata vuol dire «in cima»): i
    // numeri restano sulla stessa riga anche se un'etichetta va a capo.
    <div className="flex flex-col-reverse justify-end gap-1">
      <dt className="text-sm text-muted-foreground">
        {label}
        {note ? <span className="block text-meta text-muted-foreground">{note}</span> : null}
      </dt>
      <dd
        data-testid={testId}
        className={`tnum w-exp font-semibold leading-none ${
          size === 'lg' ? 'text-4xl sm:text-5xl' : 'text-3xl'
        } ${accent ? 'text-accent' : ''}`}
      >
        {value}
      </dd>
    </div>
  );
}
