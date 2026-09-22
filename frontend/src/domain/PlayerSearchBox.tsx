import { useEffect, useId, useState } from 'react';
import type { Role } from '../api/types';
import { usePlayerSearch } from '../api/usePlayerSearch';
import { EmptyState } from './EmptyState';
import { RoleBadge } from './RoleBadge';
import { ROLES } from './roles';

/** La lente della ricerca: tratto vettoriale, mai un'emoji. */
function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M16.5 16.5 21 21" />
    </svg>
  );
}

/**
 * La ricerca per nome: una barra sola, e sotto — quando si sta cercando — le
 * pillole di ruolo e l'elenco dei nomi.
 *
 * <p>Niente modale e niente riquadro attorno alla barra: il bordo del campo e'
 * l'unico contorno, e i risultati crescono dove si sta guardando, subito sotto
 * quello che si e' appena digitato. Il posto che occupano lo cede il battitore,
 * che chi monta questa ricerca nasconde mentre {@code onActiveChange} dice "sto
 * cercando" — cosi' la pagina sotto non balla a ogni lettera.
 *
 * <p>"Sto cercando" non e' uno stato che si apre e si chiude con un bottone: e'
 * semplicemente avere scritto qualcosa o aver scelto un ruolo. Si esce
 * cancellando, con Esc, o scegliendo un nome — e in tutti e tre i casi la barra
 * torna vuota e il battitore riprende il suo posto.
 *
 * <p>Non conosce il tabellone: sceglie solo un identificativo e lo passa a
 * {@code onSelect}, la STESSA selezione che produce una riga della tabella di
 * fase.
 */
/** Un giocatore gia' comprato, come lo legge il tabellone: chi l'ha preso e a quanto. */
export interface SoldPlayer {
  key: string;
  name: string;
  role: Role;
  buyer: string;
  price: number;
}

/** Quanti comprati mostra al massimo, sotto i risultati. */
const SOLD_SHOWN = 4;

/** Minuscole e senza accenti: «Lukaku» si trova anche scrivendo «lukàku». */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('it');
}

export function PlayerSearchBox({
  onSelect,
  onActiveChange,
  sold = [],
}: {
  onSelect: (playerId: string) => void;
  onActiveChange?: (active: boolean) => void;
  /**
   * I giocatori gia' comprati: la ricerca del server li esclude, giustamente, ma
   * senza dirlo cercare «Lautaro» a meta' asta rispondeva «Nessun giocatore
   * trovato», come se non esistesse. Qui si dice di chi e' e a quanto.
   */
  sold?: SoldPlayer[];
}) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const searchId = useId();
  const roleGroupName = useId();

  const { data, isFetching } = usePlayerSearch(query, role);

  const active = query.trim() !== '' || role !== null;
  const noResults = active && !isFetching && data !== undefined && data.length === 0;
  // Solo col testo: filtrare i comprati per il solo ruolo non risponde a nessuna
  // domanda. Due lettere almeno, come la ricerca vera.
  const needle = fold(query.trim());
  const soldMatches = needle.length >= 2
    ? sold.filter((p) => fold(p.name).includes(needle) && (role === null || p.role === role))
      .slice(0, SOLD_SHOWN)
    : [];

  useEffect(() => {
    onActiveChange?.(active);
  }, [active, onActiveChange]);

  function reset() {
    setQuery('');
    setRole(null);
  }

  // Statico, non una live region: la pagina ne ha una sola (AuctionAnnouncer),
  // e una seconda competerebbe con quella. "Nessun risultato" ha gia' una frase
  // visibile (sotto, con EmptyState) che chi ascolta raggiunge da sola: qui
  // serve solo lo stato che altrimenti non avrebbe alcuna traccia testuale,
  // "sto cercando".
  const searchingHint = isFetching ? 'Ricerca in corso.' : '';

  return (
    // Esc sul contenitore, non sul solo campo di testo: svuota campo e ruolo
    // da qualunque punto della ricerca — anche col fuoco su una pillola o su un
    // nome dell'elenco, che e' dove si finisce dopo due tabulazioni. Legato al
    // solo <input>, la via d'uscita spariva appena ci si spostava.
    // Il clic fuori deliberatamente NON chiude: si perderebbe una ricerca a
    // meta' per un clic di troppo.
    // Un pannello solo, con un bordo solo: "tutto cio' che si legge sta dentro
    // un pannello, mai direttamente sull'erba" (index.css) — in linea sopra il
    // campo i nomi avevano le righe del disegno che gli passavano attraverso.
    // Il campo di testo qui dentro NON porta un bordo suo: il contorno del
    // pannello e' gia' il contorno della barra, e disegnarne un secondo era il
    // doppio riquadro di prima. A riposo il pannello e' alto quanto la barra;
    // cercando cresce verso il basso, e il filo che separa la barra dai
    // risultati dice dove finisce quello che si scrive.
    // h-full: quando chi lo monta gli da' una colonna da riempire (durante la
    // ricerca il pannello e' l'unica cosa in quella colonna), arriva in fondo
    // come i due pannelli accanto, invece di fermarsi a mezz'aria. Fuori da un
    // contenitore con un'altezza, h-full non fa nulla: a riposo resta alto
    // quanto la barra.
    <div
      className="panel flex h-full flex-col rounded-2xl"
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        reset();
      }}
    >
      <div className="relative">
        {/* L'etichetta e' nascosta alla vista ma non all'albero di
            accessibilita': il placeholder da solo sparisce appena si scrive, e
            chi ascolta resterebbe con un campo senza nome. */}
        <label htmlFor={searchId} className="sr-only">
          Cerca giocatore
        </label>
        <SearchIcon />
        <input
          id={searchId}
          type="search"
          value={query}
          placeholder="Cerca giocatore"
          onChange={(e) => setQuery(e.target.value)}
          className="min-h-12 w-full rounded-2xl bg-transparent pl-12 pr-4 text-base placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        />
      </div>

      <span className="sr-only">{searchingHint}</span>

      {active ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 border-t border-line p-3">
          {/* Radio nativi, non bottoni con role="radio": un radiogroup ARIA finto
              promette le frecce e un solo fermo in tabulazione, e non le mantiene
              senza gestire la tastiera a mano. Un <input type="radio"> vero le
              regala gratis (roving tabindex, frecce), e <fieldset>/<legend> danno
              al gruppo il nome accessibile senza aria-label — lo stesso schema di
              "sei tu" in ParticipantsFieldset. L'input resta sr-only (non hidden,
              non display:none): deve restare a fuoco raggiungibile, e' la
              <label> a portare la pillola visibile e il bersaglio cliccabile.

              Solo i ruoli: le venti pillole delle squadre, in questa colonna
              stretta, andavano a capo per tre righe e spingevano i nomi fuori
              dalla vista. In asta si cerca per nome, non si sfogliano le
              squadre. */}
          <fieldset className="m-0 border-0 p-0">
            <legend className="sr-only">Filtra per ruolo</legend>
            <div className="flex flex-wrap gap-2">
              <label
                className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border px-3 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
                  role === null ? 'border-accent bg-accent font-bold text-on-accent' : 'border-line-strong text-muted-foreground'
                }`}
              >
                <input
                  type="radio"
                  name={roleGroupName}
                  checked={role === null}
                  onChange={() => setRole(null)}
                  className="sr-only"
                />
                Tutti
              </label>
              {ROLES.map((r) => (
                <label
                  key={r}
                  // min-w-11 qui non e' decorativo: senza, il bersaglio tattile
                  // della pillola sarebbe largo quanto RoleBadge (24px), molto
                  // sotto i 44px richiesti su ogni controllo — lo stesso debito
                  // gia' chiuso per la tabella di fase (PlayerTable.tsx), dove
                  // pero' dipendeva dall'auto-layout della cella. Qui e' esplicito.
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
                >
                  <input
                    type="radio"
                    name={roleGroupName}
                    checked={role === r}
                    onChange={() => setRole(r)}
                    className="sr-only"
                  />
                  <RoleBadge role={r} filled={role === r} />
                </label>
              ))}
            </div>
          </fieldset>

          {noResults && soldMatches.length === 0 ? (
            <EmptyState>Nessun giocatore trovato.</EmptyState>
          ) : noResults ? null : (
            // L'elenco prende tutta l'altezza che il pannello ha, e si scorre.
            //
            // Il tetto di max-h-60 serviva quando il pannello cresceva sulla
            // pagina: un elenco alto quanto voleva allungava la riga della
            // griglia, e con essa le colonne accanto, che si stiravano a ogni
            // lettera digitata. Da lg in su quel rischio non esiste piu' — la
            // riga ha un'altezza fissa (si veda AuctionRoute) e il pannello e'
            // alto quanto la colonna — mentre il tetto restava, e lasciava
            // mezzo riquadro vuoto sotto cinque righe e mezzo di risultati.
            // Sotto lg la riga torna alta quanto il contenuto, e li' il tetto
            // serve ancora: senza, cinquanta risultati spingerebbero mezza
            // pagina in basso.
            //
            // La mezza riga tagliata dal bordo resta deliberata: dice che sotto
            // ce n'e' dell'altro, come non farebbe un taglio netto a filo di
            // riga.
            <>
            {/* Le intestazioni sopra le colonne, con le stesse larghezze delle righe:
                senza, squadra e quotazione erano due colonne di cui si doveva
                indovinare il senso. Nascoste a chi ascolta: ogni riga e' un
                bottone che dice gia' nome, squadra e prezzo. */}
            {data && data.length > 0 ? (
              <div aria-hidden="true" className="-mb-3 flex shrink-0 items-center gap-3 border-b border-line-strong px-2 pb-2 text-xs font-bold text-muted-foreground">
                <span className="w-6 shrink-0" />
                <span className="min-w-0 max-w-64 flex-1">Giocatore</span>
                <span className="w-20 shrink-0">Squadra</span>
                <span className="w-20 shrink-0 text-right">Quotazione</span>
              </div>
            ) : null}
            <ul
              aria-label="Risultati della ricerca"
              className="flex max-h-60 min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain lg:max-h-none"
            >
              {(data ?? []).map((player) => (
                <li key={player.id}>
                  <button
                    type="button"
                    // Scegliere chiude la ricerca: la barra torna vuota e il
                    // battitore riprende il suo posto, col giocatore appena scelto.
                    onClick={() => {
                      onSelect(player.id);
                      reset();
                    }}
                    className="flex min-h-11 w-full items-center gap-3 border-b border-line px-2 text-left hover:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {/* Le tre colonne si fermano dove finisce la lettura, non
                        dove finisce la colonna: con il nome elastico su tutta la
                        larghezza, squadra e prezzo finivano schiacciati contro il
                        bordo destro a un palmo di distanza dal nome a cui si
                        riferiscono. Larghezze fisse (che cedono solo in stretto)
                        incolonnano i prezzi e tengono la riga insieme. */}
                    <span className="flex w-6 shrink-0 justify-center"><RoleBadge role={player.role} /></span>
                    <span className="min-w-0 max-w-64 flex-1 truncate">{player.name}</span>
                    <span className="w-20 shrink-0 truncate text-sm text-muted-foreground">{player.team}</span>
                    <span className="tnum w-20 shrink-0 text-right text-sm text-muted-foreground">
                      {/* Lo spazio sta DOPO il numero, nello stesso nodo di testo: un
                          nodo separato che iniziasse per spazio (o uno spazio soltanto,
                          come suo unico contenuto) verrebbe scartato dal calcolo del
                          nome accessibile, che rifila gli spazi iniziali/finali di ogni
                          sottoalbero prima di concatenare. Cosi' "20" e "crediti" non
                          si saldano in "20crediti". */}
                      {`${player.listPrice} `}
                      <span className="sr-only">crediti</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            </>
          )}

          {soldMatches.length > 0 ? (
            <div className="shrink-0 rounded-xl border border-line p-3">
              <p className="text-sm font-bold text-muted-foreground">
                {noResults ? 'Già comprato, non è più all\'asta' : 'Già comprati'}
              </p>
              <ul aria-label="Giocatori già comprati" className="mt-1">
                {soldMatches.map((p) => (
                  <li key={p.key} className="flex min-h-10 items-center gap-3 text-sm">
                    <span aria-hidden="true"><RoleBadge role={p.role} /></span>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-bold">{p.name}</span>
                      {` è di ${p.buyer}`}
                    </span>
                    <span className="tnum shrink-0 text-muted-foreground">{`${p.price} crediti`}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
