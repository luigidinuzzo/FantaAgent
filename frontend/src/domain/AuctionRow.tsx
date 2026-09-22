import type { CSSProperties } from 'react';
import type { AuctionCard } from '../api/types';
import { AuctionRowMenu, type MenuAction } from './AuctionRowMenu';
import { RoleBadge } from './RoleBadge';
import { ROLE_NAME_PLURAL } from './roles';
import {
  auctionStatus, crestIndex, crestLetter, FULL_DATE, STATUS_LABEL, STATUS_VERB, whenLabel,
} from './auctionStatus';

/** Le classi dei sei colori dello stemma, scritte per intero: Tailwind le cerca nel sorgente. */
const CREST_BG = [
  'bg-crest-1', 'bg-crest-2', 'bg-crest-3', 'bg-crest-4', 'bg-crest-5', 'bg-crest-6',
] as const;

/** Lo stato come etichetta: verde solo per «Conclusa», che e' un fatto positivo. */
const STATUS_CLASS = {
  'da-iniziare': 'border-line-strong text-muted-foreground',
  'in-corso': 'border-line-strong text-foreground',
  conclusa: 'border-positive text-positive',
} as const;

/**
 * Una riga dell'elenco delle aste.
 *
 * <p><b>Tutta la riga apre l'asta.</b> Il bottone col verbo si estende sull'intera
 * riga con un {@code ::after} assoluto: un solo elemento interattivo, un solo nome
 * accessibile, e il bersaglio non e' piu' un bottone a mezzo schermo dal nome. Il
 * menu «⋯» sta sopra quello strato (z-10) e resta cliccabile per conto suo.
 *
 * <p><b>I dettagli sono quelli veri dell'asta</b>, dalla sua riga del server: fase,
 * giocatori presi sul totale delle rose, squadre, e i crediti rimasti di chi usa
 * l'app. Nessun dato stimato.
 */
export function AuctionRow({
  auction: a, disabled, onOpen, actions, enterIndex, now,
}: {
  auction: AuctionCard;
  disabled: boolean;
  onOpen: () => void;
  actions: MenuAction[];
  /** Posizione nell'ingresso a cascata, o null se la riga non deve entrare animata. */
  enterIndex: number | null;
  now: Date;
}) {
  const status = auctionStatus(a);
  const verb = STATUS_VERB[status];
  const enter: CSSProperties | undefined = enterIndex === null
    ? undefined
    : { animationDelay: `${enterIndex * 60}ms` };

  return (
    <li
      style={enter}
      // Il contorno di messa a fuoco sta sulla riga intera quando il bottone ha il
      // focus: e' la riga il bersaglio, e sul telefono il bottone non si vede.
      className={`relative flex min-h-[6.5rem] items-center gap-3 px-4 py-3 hover:bg-white/[0.04] has-[>button:focus-visible]:outline has-[>button:focus-visible]:outline-2 has-[>button:focus-visible]:-outline-offset-2 has-[>button:focus-visible]:outline-accent sm:gap-4 sm:px-6 ${
        enterIndex === null ? '' : 'row-enter'
      }`}
    >
      {/* Lo stemma: decorazione, il nome e' gia' scritto accanto. Quadrato pieno
          e non cerchio vuoto, per non somigliare al badge del ruolo qui sotto. */}
      <span
        aria-hidden="true"
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-black text-on-accent ${
          CREST_BG[crestIndex(a.id)]
        }`}
      >
        {crestLetter(a.label)}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-lg font-bold">{a.label}</span>
          <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${STATUS_CLASS[status]}`}>
            {STATUS_LABEL[status]}
          </span>
          {a.selected ? (
            // Il fatto sta nel testo: il pallino accanto e' solo decorazione.
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-accent">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
              Aperta ora
            </span>
          ) : null}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground sm:text-base">
          {/* Ogni voce dopo la prima porta il suo «·» davanti, nello stesso blocco
              che non va a capo: andando a capo su uno schermo stretto il
              separatore restava da solo in fondo alla riga. La fase manca solo
              sul telefono, dove lo spazio va al conto dei giocatori. */}
          {status === 'conclusa' ? null : (
            <span className="hidden sm:inline-flex">
              <PhaseLabel role={a.phase} />
            </span>
          )}
          {/* .tnum: le cifre si confrontano riga per riga. Numero e parola nello
              stesso nodo di testo: getByText concatena solo i nodi diretti. */}
          <Item first={status === 'conclusa' ? 'always' : 'on-phone'}>{progressLabel(a)}</Item>
          {a.teams > 0 ? <Item>{`${a.teams} squadre`}</Item> : null}
          {a.myBudgetRemaining !== null
            ? <Item>{`ti restano ${a.myBudgetRemaining} crediti`}</Item>
            : null}
        </p>
      </div>

      {/* La data in una colonna sua, allineata a destra: si scorre dall'alto in
          basso per trovare l'ultima usata. Esatta al passaggio e per chi ascolta. */}
      {a.lastWritten ? (
        <time
          dateTime={a.lastWritten}
          title={FULL_DATE.format(new Date(a.lastWritten))}
          className="tnum hidden w-28 shrink-0 text-right text-sm text-muted-foreground md:block"
        >
          {whenLabel(a.lastWritten, now)}
        </time>
      ) : null}

      <button
        type="button"
        disabled={disabled}
        onClick={onOpen}
        aria-label={`${verb} ${a.label}`}
        // Pieno solo sull'asta aperta: e' «dove sei». Sulle altre il giallo pieno
        // competerebbe con «Crea asta». Larghezza fissa, qualunque sia il verbo:
        // cosi' la colonna delle date si allinea. Sul telefono il bottone si
        // riduce a zero (il suo ::after copre comunque tutta la riga) e lascia lo
        // spazio al nome: non sr-only, che lo renderebbe position:absolute e
        // restringerebbe il ::after al bottone stesso.
        className={`min-h-11 w-28 shrink-0 rounded-full font-bold disabled:opacity-50 focus-visible:outline-none after:absolute after:inset-0 after:content-[''] max-sm:h-0 max-sm:min-h-0 max-sm:w-0 max-sm:overflow-hidden max-sm:border-0 max-sm:p-0 ${
          a.selected
            ? 'bg-accent text-on-accent'
            : 'border border-line-strong text-foreground'
        }`}
      >
        {verb}
      </button>
      <AuctionRowMenu label={a.label} actions={actions} />
    </li>
  );
}

/** «48 di 200 giocatori»; senza il totale, il solo conteggio degli acquisti. */
function progressLabel(a: AuctionCard): string {
  if (a.totalSlots > 0) return `${a.purchases} di ${a.totalSlots} giocatori`;
  return a.purchases === 1 ? '1 acquisto' : `${a.purchases} acquisti`;
}

/**
 * Una voce dei dettagli, col separatore davanti se non e' la prima. Il «·» e'
 * decorazione: chi ascolta sente le voci come testi separati.
 */
function Item({ children, first = 'never' }: {
  children: string;
  /** «on-phone»: prima voce solo sul telefono, dove la fase davanti non c'e'. */
  first?: 'never' | 'always' | 'on-phone';
}) {
  return (
    <span className="inline-flex gap-2 whitespace-nowrap">
      {first === 'always' ? null : (
        <span aria-hidden="true" className={first === 'on-phone' ? 'hidden sm:inline' : ''}>·</span>
      )}
      <span className="tnum">{children}</span>
    </span>
  );
}

/**
 * La fase in cui l'asta e' rimasta, per esteso: una «P» in un cerchio da sola non
 * diceva che fosse una fase. La lettera colorata e' per chi guarda.
 */
function PhaseLabel({ role }: { role: AuctionCard['phase'] }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true">
        <RoleBadge role={role} />
      </span>
      {`Fase ${ROLE_NAME_PLURAL[role]}`}
    </span>
  );
}
