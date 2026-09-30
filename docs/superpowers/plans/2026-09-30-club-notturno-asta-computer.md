# Club Notturno, l'asta sul computer — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La schermata dell'asta, da `lg` in su, diventa quella del mockup approvato: tre colonne alte quanto la finestra, banco a misura fissa, tabella dei giocatori dentro il primo schermo, colonna «I tuoi consigli» sempre piena, e nel conto alla rovescia l'offerta come numero su cui si decide.

**Architecture:** `AuctionRoute` smette di impilare riga d'asta e schede: la colonna centrale diventa una griglia a tre righe (ricerca, banco, schede) alta quanto la finestra meno le due barre. L'altezza del banco vive in una variabile CSS sola, `--banco-h`, misurata nell'ultimo task. La colonna di destra diventa un componente nuovo, `AdviceColumn`, che compone pezzi che esistono già (`PhaseTargets`, `AnalysisPanel`) e uno nuovo (`MyRoster`). Nessun dato nuovo: tutto viene da `/state`, `/board`, `/players/*` come oggi.

**Tech Stack:** React 19, TypeScript, Tailwind v4, TanStack Query, vitest + Testing Library, Playwright (`npm run screens`).

**Spec:** `docs/superpowers/specs/2026-09-30-club-notturno-fondamenta-asta-design.md` §4 (e §2, §3 per i vincoli). Punto di partenza misurato: `docs/superpowers/decisions/2026-09-30-club-notturno-fondamenta.md` («Il banco, misurato», «Deviazioni dalla specifica»).

## Global Constraints

- Nessuna modifica al backend, ai DTO, agli indirizzi. Nessuna chiamata nuova: ogni numero viene da ciò che la schermata già scarica.
- Tutto questo piano vale da `lg` in su. Sotto `lg` la schermata dell'asta resta com'è oggi (il telefono ha un piano suo): ogni classe nuova di impaginazione porta il prefisso `lg:` o sta in un componente che sotto `lg` rende come prima.
- **Le scatole hanno misura decisa in anticipo.** Il banco ha la stessa altezza in ogni stato (`--banco-h`), le colonne laterali la stessa larghezza; niente si sposta passando da riposo a lotto a conto a tempo scaduto. Se un contenuto non ci sta, scorre dentro la sua scatola.
- **Niente grafici inventati al posto dei numeri.** Nessuna barra, anello o indicatore nuovo: numeri e parole.
- A 1440×900 la pagina dell'asta non scorre, e sotto il banco si vedono almeno quattro righe della tabella.
- L'oro solo in quattro posti: l'azione principale, il numero su cui si decide (tetto a riposo e col lotto, offerta corrente col conto avviato, i tuoi crediti), «dove sei» (scheda attiva), ciò che è tuo in un elenco (la tua squadra).
- Un numero eroe per schermata (`weights.test.ts`): il tetto nella scheda del lotto, l'offerta nel conto alla rovescia.
- Ciò che vede solo chi guarda porta il distintivo «Solo tu» / «Lo vedi solo tu». La proiezione non importa nessuno dei componenti toccati qui (regola oxlint in `.oxlintrc.json`, da non allargare né aggirare).
- Raggi `rounded-lg`; `rounded-full` solo per stati ed etichette, e ogni nuovo uso entra nell'elenco `PILLS` di `src/styles/shapes.test.ts` con la sua ragione. Mai `text-xs`. Bersagli da 44px. Classi dei bottoni da `domain/controls.ts`.
- Testi per utenti finali, in italiano. Lessico: banco, banditore.
- Un solo `role="alert"` per schermata. `AuctionAnnouncer` resta l'unica live region.
- Le prove che affermano la vecchia impaginazione (posizioni, classi, «le alternative stanno nel banco») si riscrivono per affermare la nuova; ogni prova cambiata va elencata nel rapporto del task con la ragione. Una prova che fallisce per un comportamento (non per una classe o una posizione) non si cambia: si ferma il task.
- Ramo: `ridisegno-asta`, staccato da `main`. Tutti i comandi `npm` da `frontend/`. Ogni commit in italiano, con la riga `Co-Authored-By:` del modello che lo scrive.

## File toccati

| File | Cosa diventa |
|---|---|
| `frontend/src/domain/PhaseSwitcher.tsx` | Controllo segmentato col nome della fase |
| `frontend/src/domain/ParticipantsColumn.tsx` | Righe in un pannello solo, alte quanto la colonna |
| `frontend/src/domain/OnlyYouBadge.tsx` (nuovo) | Il distintivo «Solo tu» |
| `frontend/src/domain/MyRoster.tsx` (nuovo) | «La tua rosa»: un ruolo per riga |
| `frontend/src/domain/AdviceColumn.tsx` (nuovo) | La colonna «I tuoi consigli» |
| `frontend/src/domain/AnalysisPanel.tsx` | Variante senza cornice; affidabilità a parole |
| `frontend/src/domain/PhaseTargets.tsx` | Variante senza cornice |
| `frontend/src/domain/MyTeamSummary.tsx` | Crediti in oro, quattro acquisti, due colonne da `lg` |
| `frontend/src/domain/PlayerDecisionCard.tsx` | Quotazione nella testata, distintivo, tetto più grande |
| `frontend/src/domain/BidderDialog.tsx` | Tempo, offerta, in testa; tetto nella riga privata |
| `frontend/src/domain/PhasePager.tsx` | Variante compatta per la riga delle schede |
| `frontend/src/domain/PlayerTable.tsx` | Variante che riempie il pannello, intestazione ferma |
| `frontend/src/domain/RosterGrid.tsx` | Variante che riempie il pannello, la tua colonna ferma |
| `frontend/src/routes/AuctionRoute.tsx` | La griglia alta quanto la finestra |
| `frontend/src/index.css` | `--banco-h` |
| `frontend/scripts/screens.mjs` | Misure e controlli di trabocco |

---

### Task 1: Il ramo, e la fase col suo nome

La barra dei comandi mostra oggi quattro lettere colorate; nel mockup approvato la fase è un controllo segmentato col nome per esteso.

**Files:**
- Modify: `frontend/src/domain/PhaseSwitcher.tsx`, `frontend/src/domain/PhaseSwitcher.test.tsx`
- Modify: `frontend/src/styles/shapes.test.ts` (una voce in `PILLS`)

**Interfaces:**
- Produces: `PhaseSwitcher` con le stesse props di oggi (`phases`, `current`, `onChange`, `pending`) e gli stessi nomi accessibili («Difensori, fase corrente», «Centrocampisti»).

- [ ] **Step 1: Il ramo**

Il ramo `ridisegno-asta` esiste già: è stato creato con il commit di questo piano. Verificare di esserci sopra:

```bash
git branch --show-current   # ridisegno-asta
```

- [ ] **Step 2: Le prove**

In `frontend/src/domain/PhaseSwitcher.test.tsx` sostituire la prova «la fase corrente si legge piu grande delle altre» con:

```tsx
  /**
   * Quattro lettere colorate non dicevano cosa si stava chiamando a chi non le
   * conosceva gia'. Da schermo largo il nome e' scritto; la corrente si stacca per
   * fondo e per il filetto del suo ruolo, non per colore da solo.
   */
  it('la fase porta il suo nome, e la corrente si stacca per fondo', () => {
    render(<PhaseSwitcher phases={['P', 'D', 'C', 'A']} current="D" onChange={() => {}} pending={false} />);

    const corrente = screen.getByRole('button', { name: /difensori, fase corrente/i });
    const altra = screen.getByRole('button', { name: /^attaccanti$/i });
    expect(corrente).toHaveTextContent('Difensori');
    expect(altra).toHaveTextContent('Attaccanti');
    expect(corrente.className).toContain('bg-surface-raised');
    expect(altra.className).not.toContain('bg-surface-raised');
  });
```

- [ ] **Step 3: Vederla fallire**

Run: `npm test -- src/domain/PhaseSwitcher.test.tsx`
Expected: FAIL sulla prova nuova (il bottone contiene solo la lettera).

- [ ] **Step 4: Il controllo segmentato**

Sostituire il `return` di `PhaseSwitcher` (e il commento che lo precede sui bottoni sciolti) con:

```tsx
  return (
    // Un controllo segmentato: un contenitore solo con le quattro fasi dentro. La
    // corrente ha il fondo rialzato e il filetto del suo ruolo sotto; le altre
    // restano leggibili, mai smorzate con un'opacita'. Il nome per esteso da xl in
    // su: fra lg e xl la barra dei comandi non ha posto per quattro parole e tre
    // comandi scritti, e restano le lettere.
    <nav aria-label="Fase dell'asta" className="flex items-center gap-0.5 rounded-lg border border-panel-border bg-surface p-0.5">
      {phases.map((role) => {
        const isCurrent = role === current;
        return (
          <button
            key={role}
            type="button"
            disabled={pending || isCurrent}
            aria-label={isCurrent ? `${ROLE_NAME_PLURAL[role]}, fase corrente` : ROLE_NAME_PLURAL[role]}
            onClick={() => onChange(role)}
            className={`flex min-h-10 min-w-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
              isCurrent ? `bg-surface-raised text-foreground ${UNDERLINE[role]}` : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {/* Il pallino del ruolo: e' uno stato (quale fase), per questo tondo. */}
            <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${BG_ROLE_CLASS[role]}`} />
            <span aria-hidden="true" className="xl:hidden">{role}</span>
            <span aria-hidden="true" className="max-xl:hidden">{ROLE_NAME_PLURAL_CAPITALIZED[role]}</span>
          </button>
        );
      })}
    </nav>
  );
```

In testa al file, al posto dell'import di `RoleBadge` e di `ROLE_NAME_PLURAL` (l'import del tipo `Role` da `../api/types` resta: serve a `UNDERLINE`):

```tsx
import { BG_ROLE_CLASS, ROLE_NAME_PLURAL, ROLE_NAME_PLURAL_CAPITALIZED } from './roles';

// Il filetto sotto la fase corrente, nel colore del suo ruolo. Scritte per intero:
// Tailwind trova le classi leggendo il sorgente.
const UNDERLINE: Record<Role, string> = {
  P: 'shadow-[inset_0_-2px_0_var(--color-role-p)]',
  D: 'shadow-[inset_0_-2px_0_var(--color-role-d)]',
  C: 'shadow-[inset_0_-2px_0_var(--color-role-c)]',
  A: 'shadow-[inset_0_-2px_0_var(--color-role-a)]',
};
```

`min-h-10` (40px) dentro un contenitore con `p-0.5` e bordo fa 44px di controllo: l'altezza dei bottoni della barra.

Nel commento in testa al componente togliere le frasi sulle «pastiglie» e sulla parola «Fase» accanto alle lettere, che non ci sono più.

In `frontend/src/styles/shapes.test.ts`, dentro `PILLS`:

```ts
  // Il pallino del ruolo in ogni fase del controllo segmentato.
  ['domain/PhaseSwitcher.tsx', 1],
```

- [ ] **Step 5: Vedere le prove passare**

Run: `npm test -- src/domain/PhaseSwitcher.test.tsx src/styles/shapes.test.ts src/routes/AuctionRoute.test.tsx`
Expected: PASS. Le prove dell'asta cercano i bottoni della fase per nome accessibile, che non cambia.

Run: `npm test && npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/domain/PhaseSwitcher.tsx frontend/src/domain/PhaseSwitcher.test.tsx frontend/src/styles/shapes.test.ts
git commit -m "La fase dell'asta col suo nome, in un controllo segmentato"
```

---

### Task 2: Le squadre come righe

**Files:**
- Modify: `frontend/src/domain/ParticipantsColumn.tsx`, `frontend/src/domain/ParticipantsColumn.test.tsx`

**Interfaces:**
- Produces: `ParticipantsColumn({ participants, phase })`, props invariate. Da `lg` le righe si dividono l'altezza della colonna; sotto `lg` resta la fila che scorre di lato di oggi.

- [ ] **Step 1: Le prove**

In `ParticipantsColumn.test.tsx` aggiungere (le funzioni e i dati di prova in testa al file restano quelli che ci sono):

```tsx
  /**
   * Un pannello solo con le righe separate da una linea: otto card dentro una card
   * erano otto cornici in piu' da leggere. La tua riga si riconosce dal fondo e dal
   * filetto oro a sinistra, oltre che a parole.
   */
  it('da schermo largo le squadre sono righe di un pannello solo, la tua col filetto oro', () => {
    render(<ParticipantsColumn participants={PARTICIPANTS} phase="C" />);
    const rows = screen.getAllByRole('listitem');
    rows.forEach((row) => expect(row.className).toContain('lg:border-b'));
    const mine = rows.find((row) => row.getAttribute('data-me') === 'true')!;
    expect(mine.className).toContain('lg:border-l-accent');
    expect(mine.className).toContain('bg-surface-raised');
  });

  // Il nome intero: «Atletico Ma No…» non si riconosceva a colpo d'occhio.
  it('il nome della squadra va su due righe invece di troncarsi', () => {
    render(<ParticipantsColumn participants={PARTICIPANTS} phase="C" />);
    const name = screen.getAllByRole('listitem')[0].querySelector('[data-testid="team-name"]')!;
    expect(name.className).toContain('lg:line-clamp-2');
    expect(name.className).not.toMatch(/(^| )truncate( |$)/);
  });
```

Se nel file i dati di prova non si chiamano `PARTICIPANTS`, usare il nome che hanno.

- [ ] **Step 2: Vederle fallire**

Run: `npm test -- src/domain/ParticipantsColumn.test.tsx`
Expected: FAIL sulle due prove nuove.

- [ ] **Step 3: Le righe**

Il `return` di `ParticipantsColumn` diventa:

```tsx
  return (
    <section
      aria-label="Crediti delle squadre"
      className="panel flex min-h-0 min-w-0 flex-col max-lg:p-3 lg:overflow-hidden"
    >
      <div aria-hidden="true" className="flex shrink-0 justify-between px-3 text-meta font-medium text-muted-foreground max-lg:mb-2 lg:min-h-11 lg:items-center lg:border-b lg:border-line lg:px-4">
        <span>Squadra</span>
        <span>Crediti</span>
      </div>
      {/* Sul telefono una fila che scorre di lato, alta una riga, come prima. Da
          schermo largo una colonna di righe che si dividono l'altezza del pannello:
          con otto squadre ognuna prende un ottavo, con dodici la lista scorre. */}
      <ul className="relative flex min-h-0 flex-1 gap-1.5 overflow-x-auto pb-1 max-lg:flex-row lg:flex-col lg:gap-0 lg:overflow-y-auto lg:overflow-x-visible lg:pb-0">
        {participants.map((p) => (
          <li
            key={p.id}
            data-testid={`manager-${p.id}`}
            data-me={p.me}
            className={`flex flex-col justify-center gap-0.5 max-lg:shrink-0 max-lg:rounded-lg max-lg:border max-lg:px-3 max-lg:py-2 lg:min-h-16 lg:flex-1 lg:border-b lg:border-l-[3px] lg:border-b-line lg:px-4 lg:last:border-b-0 ${
              p.me
                ? 'bg-surface-raised max-lg:border-accent lg:border-l-accent'
                : 'max-lg:border-control-border lg:border-l-transparent'
            }`}
          >
            <span className="flex items-start justify-between gap-3">
              <span data-testid="team-name" className="font-medium max-lg:truncate lg:line-clamp-2 lg:leading-tight">
                {p.name}
                {p.me ? <span className="sr-only">, sei tu</span> : null}
              </span>
              <span
                data-testid={`budget-${p.id}`}
                className={`tnum shrink-0 text-lg font-semibold ${p.me ? 'text-accent' : ''}`}
              >
                {p.budgetRemaining}
                <span className="sr-only"> crediti</span>
              </span>
            </span>
```

Il resto della riga (la frase «cerca N …» con la sua `text-meta`) resta com'è. Il commento in testa al componente guadagna una frase: da schermo largo le squadre sono righe di un pannello solo, e il nome va su due righe invece di troncarsi.

- [ ] **Step 4: Vedere le prove passare**

Run: `npm test -- src/domain/ParticipantsColumn.test.tsx`
Expected: PASS (anche le cinque prove di prima).

Run: `npm test && npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/domain/ParticipantsColumn.tsx frontend/src/domain/ParticipantsColumn.test.tsx
git commit -m "Le squadre sono righe di un pannello solo, col nome intero su due righe"
```

---

### Task 3: La colonna «I tuoi consigli»

Oggi la colonna di destra è un pannello a riposo (le occasioni) e un altro col lotto (il perché del prezzo); le alternative al lotto stanno nel banco e ne decidono l'altezza. Dopo questo task la colonna è una sola, col distintivo «Solo tu», e contiene: a riposo le occasioni e la tua rosa; col lotto il perché del prezzo e «Invece di lui».

**Files:**
- Create: `frontend/src/domain/OnlyYouBadge.tsx`, `frontend/src/domain/MyRoster.tsx`, `frontend/src/domain/MyRoster.test.tsx`, `frontend/src/domain/AdviceColumn.tsx`, `frontend/src/domain/AdviceColumn.test.tsx`
- Modify: `frontend/src/domain/AnalysisPanel.tsx`, `frontend/src/domain/AnalysisPanel.test.tsx`
- Modify: `frontend/src/domain/PhaseTargets.tsx`
- Modify: `frontend/src/routes/AuctionRoute.tsx`, `frontend/src/routes/AuctionRoute.test.tsx`
- Modify: `frontend/src/styles/shapes.test.ts` (una voce in `PILLS`)

**Interfaces:**
- Produces: `OnlyYouBadge({ label }: { label: string })`.
- Produces: `MyRoster({ me, column }: { me: ParticipantView; column: BoardColumn | undefined })`.
- Produces: `AdviceColumn(props)` con le props elencate nello Step 5.
- Produces: `AnalysisPanel({ valuation, bare? })`; `PhaseTargets({ …, framed? })` (predefinito `true`: chi non lo passa vede il componente di oggi).

- [ ] **Step 1: Il distintivo**

Creare `frontend/src/domain/OnlyYouBadge.tsx`:

```tsx
/**
 * Il distintivo di cio' che vede solo chi guarda: il tetto, il margine, il perche'
 * del prezzo. Accanto alla proiezione, che mostra rose e crediti a tutta la sala, la
 * differenza va detta e non lasciata indovinare. E' un'etichetta, per questo tonda.
 */
export function OnlyYouBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent/40 px-2.5 py-0.5 text-meta font-semibold text-accent">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={2.4}>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
      {label}
    </span>
  );
}
```

In `shapes.test.ts`, dentro `PILLS`:

```ts
  // Il distintivo «Solo tu»: un'etichetta.
  ['domain/OnlyYouBadge.tsx', 1],
```

`border-accent/40` è un bordo, non un testo: la prova delle opacità in `contrast.test.ts` guarda solo `text-*/NN`.

- [ ] **Step 2: «La tua rosa» — prova**

Creare `frontend/src/domain/MyRoster.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BoardColumn, ParticipantView } from '../api/types';
import { MyRoster } from './MyRoster';

const ME: ParticipantView = {
  id: 'anna', name: 'Anna', initial: 'A', me: true, budgetRemaining: 120, slotsRemaining: 11,
  filledByRole: { P: 3, D: 8, C: 3, A: 0 }, slotsByRole: { P: 3, D: 8, C: 8, A: 6 },
};

const COLUMN: BoardColumn = {
  participantId: 'anna', participantName: 'Anna', me: true, budgetRemaining: 120, slotsRemaining: 11,
  byRole: {
    P: [{ seq: 1, playerName: 'Maignan', price: 32 }, { seq: 2, playerName: 'Skorupski', price: 15 }, { seq: 3, playerName: 'Audero', price: 7 }],
    D: [],
    C: [{ seq: 4, playerName: 'Pulisic', price: 90 }],
    A: [],
  },
};

describe('MyRoster', () => {
  it('una riga per ruolo, con i posti occupati su quelli che ha', () => {
    render(<MyRoster me={ME} column={COLUMN} />);
    const rows = within(screen.getByRole('list', { name: 'La tua rosa' })).getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent('3 di 3');
    expect(rows[2]).toHaveTextContent('1 di 8');
    expect(rows[3]).toHaveTextContent('0 di 6');
  });

  it('dice chi hai preso e a quanto, e quando non hai ancora nessuno', () => {
    render(<MyRoster me={ME} column={COLUMN} />);
    const rows = within(screen.getByRole('list', { name: 'La tua rosa' })).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Maignan 32 · Skorupski 15 · Audero 7');
    expect(rows[1]).toHaveTextContent('ancora nessuno');
  });

  // Il tabellone non e' ancora arrivato: la rosa c'e' lo stesso, coi posti da
  // riempire, invece di una colonna vuota.
  it('senza tabellone resta la rosa coi suoi posti', () => {
    render(<MyRoster me={ME} column={undefined} />);
    const rows = within(screen.getByRole('list', { name: 'La tua rosa' })).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('0 di 3');
  });
});
```

Run: `npm test -- src/domain/MyRoster.test.tsx`
Expected: FAIL (modulo inesistente).

- [ ] **Step 3: «La tua rosa» — componente**

Creare `frontend/src/domain/MyRoster.tsx`:

```tsx
import type { BoardColumn, ParticipantView } from '../api/types';
import { RoleBadge } from './RoleBadge';
import { ROLES } from './roles';

/**
 * La tua rosa in quattro righe, un ruolo per riga: quanti posti hai occupato su
 * quanti ne hai, e chi hai preso a quanto. A riposo, sotto le occasioni: e' la
 * domanda che viene subito dopo «chi conviene» — «e a me cosa manca».
 *
 * <p>Solo dati che la schermata legge gia': i posti per ruolo da /state, i
 * giocatori dalla tua colonna di /board. Nessun calcolo: il conto dei presi e' la
 * lunghezza dell'elenco.
 */
export function MyRoster({ me, column }: { me: ParticipantView; column: BoardColumn | undefined }) {
  return (
    <section aria-labelledby="my-roster-title" className="shrink-0">
      <h3 id="my-roster-title" className="text-meta font-semibold text-muted-foreground">La tua rosa</h3>
      <ul aria-label="La tua rosa" className="mt-1 divide-y divide-line">
        {ROLES.map((role) => {
          const bought = column?.byRole[role] ?? [];
          // Mai meno dei presi: una correzione a meta' asta non deve far leggere «4 di 3».
          const total = Math.max(me.slotsByRole[role] ?? 0, bought.length);
          return (
            <li key={role} className="flex min-h-14 items-center gap-3 py-2">
              <RoleBadge role={role} />
              <span className="min-w-0 flex-1">
                <span className="tnum block font-semibold">{`${bought.length} di ${total}`}</span>
                <span className="line-clamp-2 text-meta text-muted-foreground">
                  {bought.length === 0
                    ? 'ancora nessuno'
                    : bought.map((s) => `${s.playerName} ${s.price}`).join(' · ')}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

Run: `npm test -- src/domain/MyRoster.test.tsx`
Expected: PASS.

- [ ] **Step 4: `AnalysisPanel` e `PhaseTargets` senza cornice**

In `AnalysisPanel.tsx`:

1. La firma diventa `export function AnalysisPanel({ valuation, bare = false }: { valuation: ValuationResponse | null; bare?: boolean })`, con un commento sulla prop: dentro la colonna «I tuoi consigli», che porta già cornice e titolo.
2. Le due `<section>` prendono `className={bare ? 'flex min-h-0 flex-col' : 'panel flex min-h-0 flex-col p-5'}` (quella senza valutazione: `bare ? 'flex flex-col' : 'panel flex flex-col p-5'`).
3. Le stelle diventano parole. Al posto del blocco `<div className="flex flex-col gap-1">…</div>` con le stelle e la scritta «affidabilità della stima»:

```tsx
        {/* A parole, non in stelle: cinque stelle erano un indicatore da leggere e
            da tradurre, e «3» detto da un sintetizzatore non era una confidenza. */}
        <p data-testid="confidence" className="text-sm">
          Affidabilità della stima: <span className="tnum font-semibold">{valuation.confidenceStars} su 5</span>
        </p>
```

La funzione `Star` e la costante `STARS` si tolgono.

In `AnalysisPanel.test.tsx` la prova «dice l affidabilita della stima a parole, non solo in stelle» diventa:

```tsx
  it('dice l affidabilita della stima a parole, senza stelle', () => {
    const { container } = render(<AnalysisPanel valuation={VALUATION} />);
    expect(screen.getByTestId('confidence')).toHaveTextContent('Affidabilità della stima: 3 su 5');
    expect(container.querySelector('svg')).toBeNull();
  });
```

(con il nome e il valore di `confidenceStars` della valutazione di prova che il file già usa). Aggiungere:

```tsx
  it('senza cornice dentro la colonna dei consigli', () => {
    const { container } = render(<AnalysisPanel valuation={VALUATION} bare />);
    expect(container.firstElementChild?.className).not.toContain('panel');
  });
```

In `PhaseTargets.tsx` aggiungere la prop `framed = true` (con commento: falsa dentro la colonna «I tuoi consigli», che porta già cornice) e cambiare la classe della `<section>` in:

```tsx
      className={bare || !framed ? 'flex min-h-0 flex-col' : 'panel flex min-h-0 flex-col p-5'}
```

Run: `npm test -- src/domain/AnalysisPanel.test.tsx src/domain/PhaseTargets.test.tsx`
Expected: PASS.

- [ ] **Step 5: La colonna — prova**

Creare `frontend/src/domain/AdviceColumn.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ParticipantView, TargetView, ValuationResponse } from '../api/types';
import { AdviceColumn } from './AdviceColumn';

const ME: ParticipantView = {
  id: 'anna', name: 'Anna', initial: 'A', me: true, budgetRemaining: 120, slotsRemaining: 11,
  filledByRole: { P: 3, D: 8, C: 3, A: 0 }, slotsByRole: { P: 3, D: 8, C: 8, A: 6 },
};

const TARGETS: TargetView[] = [
  { id: 'c1', name: 'Zielinski', team: 'Monza', role: 'C', listPrice: 15, maxBid: 60, expectedPrice: 51, margin: 9, worthPursuing: true },
  { id: 'c2', name: 'Rovella', team: 'Udinese', role: 'C', listPrice: 12, maxBid: 41, expectedPrice: 41, margin: 0, worthPursuing: true },
];

const VALUATION: ValuationResponse = {
  playerId: 'c9', name: 'Mkhitaryan', team: 'Inter', role: 'C', listPrice: 21, expectedPrice: 71, maxBid: 72,
  hardCap: 86, margin: 1, walkAwayReason: '', worthPursuing: true, confidenceStars: 4,
  drivers: [{ label: 'Titolarità', contribution: 12, explanation: 'Gioca quasi sempre dall\'inizio.' }],
};

function renderColumn(overrides: Partial<Parameters<typeof AdviceColumn>[0]> = {}) {
  const onSelect = vi.fn();
  render(
    <AdviceColumn
      phase="C"
      targets={TARGETS}
      targetsLoading={false}
      targetsFailed={false}
      selectedId={null}
      valuation={null}
      bidderOpen={false}
      onSelect={onSelect}
      me={ME}
      myColumn={undefined}
      {...overrides}
    />,
  );
  return onSelect;
}

describe('AdviceColumn', () => {
  it('si chiama «I tuoi consigli» e dice che li vedi solo tu', () => {
    renderColumn();
    const column = screen.getByRole('region', { name: 'I tuoi consigli' });
    expect(within(column).getByText('Solo tu')).toBeInTheDocument();
  });

  it('a riposo: le occasioni della fase e la tua rosa', () => {
    renderColumn();
    expect(screen.getByRole('heading', { name: 'Occasioni della fase' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'La tua rosa' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Perché questo prezzo' })).toBeNull();
  });

  it('col lotto: il perche del prezzo e le alternative, senza il lotto stesso', () => {
    renderColumn({ selectedId: 'c9', valuation: VALUATION, targets: [...TARGETS, { ...TARGETS[0], id: 'c9', name: 'Mkhitaryan' }] });
    expect(screen.getByRole('heading', { name: 'Perché questo prezzo' })).toBeInTheDocument();
    const alternatives = screen.getByRole('region', { name: 'Invece di lui' });
    expect(within(alternatives).getByRole('button', { name: /Zielinski/ })).toBeInTheDocument();
    expect(within(alternatives).queryByRole('button', { name: /Mkhitaryan/ })).toBeNull();
    expect(screen.queryByRole('list', { name: 'La tua rosa' })).toBeNull();
  });

  // Un lotto alla volta: col conto avviato le alternative restano da leggere, ma
  // sceglierne una cambierebbe il giocatore sotto un rilancio in corso.
  it('col conto avviato le alternative si leggono ma non si scelgono', () => {
    renderColumn({ selectedId: 'c9', valuation: VALUATION, bidderOpen: true });
    const alternatives = screen.getByRole('region', { name: 'Invece di lui' });
    within(alternatives).getAllByRole('button').forEach((b) => expect(b).toBeDisabled());
  });
});
```

Run: `npm test -- src/domain/AdviceColumn.test.tsx`
Expected: FAIL (modulo inesistente).

- [ ] **Step 6: La colonna — componente**

Creare `frontend/src/domain/AdviceColumn.tsx`:

```tsx
import type { BoardColumn, ParticipantView, Role, TargetView, ValuationResponse } from '../api/types';
import { AnalysisPanel } from './AnalysisPanel';
import { MyRoster } from './MyRoster';
import { OnlyYouBadge } from './OnlyYouBadge';
import { PhaseTargets } from './PhaseTargets';

/**
 * La colonna di destra dell'asta: tutto cio' che vedi solo tu. Un pannello solo,
 * alto quanto la griglia, che cambia contenuto e mai forma.
 *
 * <p>A riposo le occasioni della fase e la tua rosa. Col lotto sul banco il perche'
 * del suo prezzo e le alternative, «Invece di lui»: prima stavano nel banco, sotto i
 * bottoni, e ne decidevano l'altezza. Col conto avviato le alternative restano da
 * leggere ma non si scelgono: un lotto alla volta.
 *
 * <p>La proiezione non importa questo file (regola oxlint in .oxlintrc.json, sui
 * componenti che mostra: AnalysisPanel ne e' gia' coperto).
 */
export function AdviceColumn({
  phase, targets, targetsLoading, targetsFailed, selectedId, valuation, bidderOpen, onSelect, me, myColumn,
}: {
  phase: Role | undefined;
  targets: TargetView[];
  targetsLoading: boolean;
  targetsFailed: boolean;
  /** Il giocatore sul banco, o null a riposo. */
  selectedId: string | null;
  /** La sua valutazione, quando e' arrivata. */
  valuation: ValuationResponse | null;
  bidderOpen: boolean;
  onSelect: (playerId: string) => void;
  /** La tua squadra: senza (non dovrebbe capitare a chi ha un posto) niente rosa. */
  me: ParticipantView | undefined;
  /** La tua colonna del tabellone, se e' arrivata. */
  myColumn: BoardColumn | undefined;
}) {
  return (
    <section aria-labelledby="advice-title" className="panel flex min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex min-h-11 shrink-0 items-center justify-between gap-3 border-b border-line px-4">
        <h2 id="advice-title" className="text-meta font-semibold text-muted-foreground">I tuoi consigli</h2>
        <OnlyYouBadge label="Solo tu" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-4">
        {selectedId === null ? (
          <>
            <PhaseTargets
              framed={false}
              phase={phase}
              targets={targets}
              loading={targetsLoading}
              failed={targetsFailed}
              disabled={bidderOpen}
              onSelect={onSelect}
            />
            {me ? <MyRoster me={me} column={myColumn} /> : null}
          </>
        ) : (
          <>
            <AnalysisPanel bare valuation={valuation} />
            {valuation ? (
              <PhaseTargets
                bare
                stacked
                excludeId={valuation.playerId}
                phase={phase}
                targets={targets}
                loading={targetsLoading}
                failed={targetsFailed}
                disabled={bidderOpen}
                onSelect={onSelect}
              />
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
```

`PhaseTargets` usa `aria-labelledby` sul suo titolo: con `bare` il titolo è «Invece di lui», e la prova lo trova come regione con quel nome. Se `PhaseTargets` non espone la `<section>` come regione nominata, aggiungere alla sua `<section>` il ruolo esplicito solo se necessario, verificandolo con la prova.

Run: `npm test -- src/domain/AdviceColumn.test.tsx`
Expected: PASS.

- [ ] **Step 7: La colonna prende il posto delle due di oggi, e le alternative escono dal banco**

In `frontend/src/routes/AuctionRoute.tsx`:

1. Import: `import { AdviceColumn } from '../domain/AdviceColumn';`. Se `AnalysisPanel` e `PhaseTargets` non sono più usati direttamente nel file, togliere i loro import.
2. Il blocco della colonna di destra, che oggi è

```tsx
        {seated === false ? null : selectedId === null ? (
          <PhaseTargets … />
        ) : (
          <AnalysisPanel valuation={valuation.data ?? null} />
        )}
```

   diventa

```tsx
        {seated === false ? null : (
          <AdviceColumn
            phase={currentPhase}
            targets={targets.data ?? []}
            targetsLoading={targets.isLoading}
            targetsFailed={targets.isError}
            selectedId={selectedId}
            valuation={valuation.data ?? null}
            bidderOpen={bidderOpen}
            onSelect={setSelectedId}
            me={me}
            myColumn={board.data?.columns.find((c) => c.me)}
          />
        )}
```

   con i commenti di oggi sopra il blocco riscritti in uno solo: la colonna dei consigli, che a riposo porta le occasioni e la tua rosa e col lotto il perché del prezzo e le alternative.
3. Nel banco togliere il blocco delle alternative `{valuation.data && !bidderOpen ? (<div className="mt-6 flex shrink-0 flex-col border-t border-line pt-4"><PhaseTargets bare … /></div>) : null}` con i due lunghi commenti che lo precedono.

- [ ] **Step 8: Le prove dell'asta**

Run: `npm test -- src/routes/AuctionRoute.test.tsx`

Le prove che affermavano che le alternative stanno nel banco, o che col conto avviato spariscono, ora falliscono: riscriverle perché affermino la regola nuova — le alternative stanno nella colonna «I tuoi consigli», e col conto avviato ci sono ma sono disabilitate. Le prove che cercano «Perché questo prezzo» o «Occasioni della fase» per nome continuano a trovarle. Elencare nel rapporto ogni prova cambiata con la ragione.

Run: `npm test && npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add -A frontend/src
git commit -m "La colonna «I tuoi consigli»: occasioni e rosa a riposo, perché del prezzo e alternative col lotto"
```

---

### Task 4: Il banco a riposo

**Files:**
- Modify: `frontend/src/domain/MyTeamSummary.tsx`, `frontend/src/domain/MyTeamSummary.test.tsx`

**Interfaces:**
- Produces: `MyTeamSummary`, props invariate.

- [ ] **Step 1: Le prove**

In `MyTeamSummary.test.tsx` la prova «a riposo nessun numero porta l accento» diventa:

```tsx
  // L'oro va al numero su cui si decide: a riposo sono i tuoi crediti. Gli altri
  // numeri restano bianchi, la gerarchia la fa la taglia.
  it('a riposo solo i tuoi crediti portano l accento', () => {
    const { container } = render(<MyTeamSummary me={ME} participants={PARTICIPANTS} phase="P" freeInPhase={12} board={BOARD} />);
    const accented = container.querySelectorAll('dd.text-accent');
    expect(accented).toHaveLength(1);
    expect(accented[0]).toHaveTextContent(String(ME.budgetRemaining));
  });
```

(con i nomi dei dati di prova che il file già usa; se la prova di oggi rende il componente con altre props, rendere con quelle). E aggiungere:

```tsx
  // Il banco ha un'altezza decisa: gli ultimi acquisti sono quattro, quanti ne
  // stanno accanto ai numeri senza farlo scorrere.
  it('gli ultimi acquisti sono al massimo quattro', () => {
    render(<MyTeamSummary me={ME} participants={PARTICIPANTS} phase="P" freeInPhase={12} board={BOARD} />);
    expect(within(screen.getByTestId('recent-list')).getAllByRole('listitem').length).toBeLessThanOrEqual(4);
  });
```

Se il tabellone di prova ha meno di cinque acquisti, aggiungerne in un tabellone di prova locale a questa prova, così che la prova fallisca prima della modifica.

- [ ] **Step 2: Vederle fallire**

Run: `npm test -- src/domain/MyTeamSummary.test.tsx`
Expected: FAIL sulle due prove.

- [ ] **Step 3: La modifica**

In `MyTeamSummary.tsx`:

1. `const RECENT = 8;` diventa `const RECENT = 4;`, col commento aggiornato.
2. La griglia esterna passa da `xl:grid-cols-[minmax(0,1fr)_17rem]` a `lg:grid-cols-[minmax(0,1fr)_17rem]`, e la colonna degli acquisti da `xl:border-l xl:pl-6` a `lg:border-l lg:pl-6`.
3. `Figure` prende la prop `accent?: boolean`; con `accent` la `<dd>` aggiunge `text-accent`. La prima `Figure` («crediti rimasti») la passa. Il commento sopra di essa («Senza accento: …») si riscrive: l'oro va ai tuoi crediti, il numero su cui si decide a riposo.

- [ ] **Step 4: Vedere le prove passare**

Run: `npm test -- src/domain/MyTeamSummary.test.tsx`
Expected: PASS.

Run: `npm test && npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/domain/MyTeamSummary.tsx frontend/src/domain/MyTeamSummary.test.tsx
git commit -m "Il banco a riposo: i tuoi crediti in oro, quattro ultimi acquisti accanto"
```

---

### Task 5: Il lotto sul banco

**Files:**
- Modify: `frontend/src/domain/PlayerDecisionCard.tsx`, `frontend/src/domain/PlayerDecisionCard.test.tsx`
- Modify: `frontend/src/routes/AuctionRoute.tsx` (`lotControls`), `frontend/src/routes/AuctionRoute.test.tsx`

**Interfaces:**
- Consumes: `OnlyYouBadge` (Task 3), `CONTROL_H`, `BUTTON_SECONDARY` da `domain/controls.ts`.
- Produces: `PlayerDecisionCard`, props invariate; `data-testid` invariati (`list-price`, `max-bid`, `expected-price`, `margin`, `affordable`).

- [ ] **Step 1: Le prove**

In `PlayerDecisionCard.test.tsx` aggiungere:

```tsx
  // La quotazione e' un dato del giocatore, come la squadra: sta nella testata,
  // e fra i numeri grandi restano quelli su cui si decide.
  it('la quotazione sta nella testata, accanto alla squadra', () => {
    render(<PlayerDecisionCard valuation={VALUATION} stale={false} />);
    const header = screen.getByRole('heading', { name: VALUATION.name }).closest('header')!;
    expect(within(header).getByTestId('list-price')).toHaveTextContent(String(VALUATION.listPrice));
  });

  it('dice che i numeri li vedi solo tu', () => {
    render(<PlayerDecisionCard valuation={VALUATION} stale={false} />);
    expect(screen.getByText('Lo vedi solo tu')).toBeInTheDocument();
  });
```

(con il nome della valutazione di prova che il file usa).

Run: `npm test -- src/domain/PlayerDecisionCard.test.tsx`
Expected: FAIL sulle due prove nuove.

- [ ] **Step 2: La scheda**

In `PlayerDecisionCard.tsx`:

1. Nella `<header>`, al posto di `<p className="shrink-0 text-sm text-muted-foreground">{valuation.team}</p>`:

```tsx
        <p className="shrink-0 text-sm text-muted-foreground">
          {valuation.team} · quotazione{' '}
          <span data-testid="list-price" className="tnum">{valuation.listPrice}</span>
        </p>
```

2. Dalla `<dl>` togliere la coppia `dt`/`dd` della quotazione (con il suo commento). Le colonne scorrono di uno: mercato `col-start-2`, margine `col-start-3`, «puoi offrire» `col-start-4`; la griglia da `grid-cols-[auto_auto_auto_auto_auto]` a `grid-cols-[auto_auto_auto_auto]`.
3. Subito prima della `<dl>`, dentro lo stesso `<div className={dimmed}>`:

```tsx
          <div className="mb-3"><OnlyYouBadge label="Lo vedi solo tu" /></div>
```

4. Il tetto passa da `text-[64px]` a `text-[80px]`.

Le prove che cercavano la quotazione fra i numeri grandi (per posizione o per corpo) si riscrivono: la cercano per `data-testid="list-price"`, che c'è ancora.

- [ ] **Step 3: I due gesti sulla stessa riga**

In `AuctionRoute.tsx`, dentro `lotControls`:

1. Il contenitore `<div className="flex flex-col items-start gap-4">` diventa `<div className="flex flex-wrap items-center gap-3">`.
2. «Avvia il conto alla rovescia»: `${BID_CONTROL_H} w-full max-w-[31rem] rounded-lg bg-accent px-8 text-lg …` diventa `${CONTROL_H} min-w-[16rem] max-w-[28rem] flex-1 rounded-lg bg-accent px-8 text-lg …` (il resto della stringa invariato). Import di `CONTROL_H` da `../domain/controls` se manca.
3. «Aggiudica direttamente»: la sua `className` diventa `` `${CONTROL_H} ${BUTTON_SECONDARY} px-5 text-muted-foreground hover:text-foreground` `` (import di `BUTTON_SECONDARY`).
4. I commenti sopra i due bottoni si riscrivono: sulla stessa riga, alla stessa altezza (56px); l'oro e la larghezza dicono quale dei due si usa di più.

`BidPanel`, che si apre al posto del secondo bottone, va a capo da solo per `flex-wrap`.

- [ ] **Step 4: Vedere le prove passare**

Run: `npm test -- src/domain/PlayerDecisionCard.test.tsx src/routes/AuctionRoute.test.tsx src/styles/weights.test.ts`
Expected: PASS. Una prova dell'asta che affermava `min-h-16` sul bottone del conto va riscritta su `min-h-14`: elencarla nel rapporto.

Run: `npm test && npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src
git commit -m "Il lotto sul banco: quotazione nella testata, «Lo vedi solo tu», i due gesti sulla stessa riga"
```

---

### Task 6: Il conto alla rovescia

**Files:**
- Modify: `frontend/src/domain/BidderDialog.tsx`, `frontend/src/domain/BidderDialog.test.tsx`
- Modify: `frontend/src/styles/weights.test.ts` (`HEROES`)

**Interfaces:**
- Consumes: `OnlyYouBadge` (Task 3).
- Produces: `BidderDialog`, props invariate. `data-testid` invariati: `bidder-cells`, `bidder-remaining`, `bidder-price`, `bidder-leader`, `bidder-ceiling`, `bidder-ceiling-distance`, `bidder-after`, `bidder-remaining-bar`, `bidder-shortcuts`. Nuovo: `bidder-private`.

- [ ] **Step 1: Le prove**

In `BidderDialog.test.tsx`:

1. Le prove che affermano che la cella «in testa» si accende d'oro quando sei tu (oggi alle righe ~135, ~144, ~371) diventano:

```tsx
  // L'oro col conto avviato e' dell'offerta: e' il numero su cui si decide. «In
  // testa» e «sei tu» lo dicono le parole, non il colore.
  it('la cella di chi e in testa non si tinge d oro, l offerta si', () => {
    renderDialog();
    expect(screen.getByTestId('bidder-leader').className).not.toContain('bg-accent');
    expect(screen.getByTestId('bidder-leader')).toHaveTextContent('sei tu');
    expect(screen.getByTestId('bidder-price').className).toContain('text-accent');
  });
```

(con la funzione di resa che il file usa; se si chiama diversamente, quella).

2. Aggiungere:

```tsx
  // Il tetto e' il riferimento fermo, non il prezzo: esce dal tabellone e scende
  // nella riga di cio' che vedi solo tu, accanto a quanto manca per arrivarci.
  it('il tetto sta nella riga privata, non fra le caselle', () => {
    renderDialog();
    const cells = screen.getByTestId('bidder-cells');
    expect(within(cells).queryByTestId('bidder-ceiling')).toBeNull();
    const privateRow = screen.getByTestId('bidder-private');
    expect(within(privateRow).getByTestId('bidder-ceiling')).toBeInTheDocument();
    expect(within(privateRow).getByText('Lo vedi solo tu')).toBeInTheDocument();
  });

  it('tre caselle mentre il conto corre, due a tempo scaduto', async () => {
    renderDialog();
    expect(screen.getByTestId('bidder-cells').querySelectorAll('[data-cell]')).toHaveLength(3);
    // …portare il conto a zero come fanno le prove di scadenza di questo file…
    expect(screen.getByTestId('bidder-cells').querySelectorAll('[data-cell]')).toHaveLength(2);
  });
```

Per la seconda metà usare lo stesso meccanismo con cui le prove di scadenza del file fanno scadere il tempo (orologio finto e avanzamento); se nel file c'è già una funzione di aiuto per questo, usarla.

3. Le prove che contano quattro celle (con consigli) o tre a tempo scaduto si aggiornano a tre e due. Elencare nel rapporto ogni prova cambiata.

Run: `npm test -- src/domain/BidderDialog.test.tsx`
Expected: FAIL sulle prove nuove e su quelle aggiornate.

- [ ] **Step 2: Le caselle**

In `BidderDialog.tsx`:

1. `CELL_COLUMNS` diventa `{ 2: 'grid-cols-2', 3: 'grid-cols-[1fr_1.25fr_1.25fr]' }` e la griglia usa `CELL_COLUMNS[expired ? 2 : 3]` (il tetto non è più una casella, con o senza consigli).
2. `Cell` perde la prop `highlighted` e le sue classi; prende `raised?: boolean`, che aggiunge `bg-surface-raised`.
3. Il numero dei secondi passa da `font-extrabold` a `font-semibold` (resta a 56px).
4. La casella dell'offerta prende `raised` e il numero passa a `text-[84px] leading-[0.85] max-sm:text-6xl`, `font-extrabold`, oro (o rosso oltre il tetto, come oggi).
5. La casella del tetto (`{advice ? (<Cell label="il tuo tetto" …>…</Cell>) : null}`) si toglie.
6. La casella «in testa»: via `highlighted`; il nome passa da `max-w-full truncate text-3xl font-semibold leading-none max-sm:text-2xl` a `line-clamp-2 break-words text-2xl font-semibold leading-tight`.
7. I commenti sopra il tabellone, sopra il tetto («Il tetto non prende l'oro…») e sopra «in testa» si riscrivono per dire la regola nuova: tre letture (tempo, offerta, chi è in testa), l'offerta come numero su cui si decide, il tetto nella riga privata sotto.

- [ ] **Step 3: La riga privata**

Subito dopo la barra del tempo (la `<div aria-hidden className={`w-full border-t …`}>`, che resta) e prima di «se lo prendi», al posto del blocco `{!expired && me ? (<div data-testid="bidder-after" …>…</div>) : null}`:

```tsx
      {/* La riga di cio' che vedi solo tu: il tetto, quanto manca per arrivarci o di
          quanto lo si e' passato, il verdetto, e «se lo prendi a N» coi numeri della
          tua squadra dopo l'acquisto. Solo mentre il conto corre: a tempo scaduto si
          registra un esito, non si decide se spingere. */}
      {advice && !expired ? (
        <div data-testid="bidder-private" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <OnlyYouBadge label="Lo vedi solo tu" />
          <span>
            il tuo tetto{' '}
            <span data-testid="bidder-ceiling" className="tnum text-lg font-semibold">
              {valuation.maxBid > 0 ? valuation.maxBid : 'nessuno'}
            </span>
          </span>
          {valuation.maxBid > 0 ? (
            <span
              data-testid="bidder-ceiling-distance"
              className={`font-medium ${overCeiling ? 'text-destructive' : toCeiling === 0 ? 'text-accent' : 'text-positive'}`}
            >
              {overCeiling ? `${-toCeiling} oltre` : toCeiling === 0 ? 'ci sei' : `${toCeiling} sotto`}
            </span>
          ) : null}
          {me ? (
            <span data-testid="bidder-after" className="tnum text-muted-foreground">
              {`se lo prendi a ${price}: `}
              <span className="font-semibold text-foreground">{Math.max(0, me.budgetRemaining - price)}</span>
              {' crediti, '}
              <span className="font-semibold text-foreground">{Math.max(0, me.slotsRemaining - 1)}</span>
              {' posti'}
              {me.slotsRemaining - 1 > 0 ? (
                <>
                  {', '}
                  <span className="font-semibold text-foreground">
                    {Math.floor(Math.max(0, me.budgetRemaining - price) / (me.slotsRemaining - 1))}
                  </span>
                  {' di media'}
                </>
              ) : null}
            </span>
          ) : null}
        </div>
      ) : null}
```

Il verdetto «Prendi/Lascia» resta dove è oggi, nella riga di riferimento in fondo con mercato e margine. Le prove che leggevano i testi di `bidder-after` («posti da riempire», «di media per posto») si aggiornano ai testi nuovi («posti», «di media»): elencarle.

- [ ] **Step 4: A tempo scaduto**

La griglia dei bottoni squadra passa da `grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(8rem,1fr))]` a `grid grid-cols-2 gap-2 sm:grid-cols-4`, e ogni bottone da `min-h-12` a `min-h-11`. Il commento sopra dice perché: quattro colonne fisse, due righe per otto squadre, il banco non si allunga.

- [ ] **Step 5: Un eroe solo**

In `frontend/src/styles/weights.test.ts`, dentro `HEROES`:

```ts
  ['domain/BidderDialog.tsx', 1],
```

col commento: mentre il conto corre il numero su cui si decide è l'offerta.

- [ ] **Step 6: Vedere le prove passare**

Run: `npm test -- src/domain/BidderDialog.test.tsx src/styles/weights.test.ts src/routes/AuctionRoute.test.tsx`
Expected: PASS.

Run: `npm test && npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A frontend/src
git commit -m "Il conto alla rovescia: tempo, offerta e chi è in testa; il tetto nella riga che vedi solo tu"
```

---

### Task 7: La griglia alta quanto la finestra

**Files:**
- Modify: `frontend/src/index.css` (`--banco-h`)
- Modify: `frontend/src/routes/AuctionRoute.tsx`, `frontend/src/routes/AuctionRoute.test.tsx`
- Modify: `frontend/src/domain/PhasePager.tsx`, `frontend/src/domain/PhasePager.test.tsx`
- Modify: `frontend/src/domain/PlayerTable.tsx`, `frontend/src/domain/PlayerTable.test.tsx`
- Modify: `frontend/src/domain/RosterGrid.tsx`, `frontend/src/domain/RosterGrid.test.tsx`

**Interfaces:**
- Produces: `--banco-h` in `:root` (usata solo qui). `PhasePager({ …, compact? })`. `PlayerTable({ …, fill? })`. `RosterGrid({ fill? })` (oggi non ha props: diventa `RosterGrid({ fill = false }: { fill?: boolean })`).

La somma, a 1440×900: barra di navigazione 56 + barra dei comandi 57 + margini della pagina 32 = 145; restano 755. Colonna centrale: ricerca 48 + spazio 16 + banco 380 + spazio 16 = 460; la tabella ne prende 295, cioè schede 44 + intestazione 36 + cinque righe da 44 abbondanti. Il minimo sotto cui la pagina scorre: 48 + 16 + 380 + 16 + 236 = 696px = 43,5rem.

- [ ] **Step 1: Le prove**

In `AuctionRoute.test.tsx`, la prova che oggi afferma `lg:h-[min(39rem,…)]` sulla riga dell'asta diventa:

```tsx
  /**
   * La riga dell'asta e' alta quanto la finestra meno le due barre e i margini, e
   * mai meno di 43,5rem: sotto, scorre la pagina. Il banco ha un'altezza sola,
   * --banco-h, in ogni stato; la tabella prende cio' che resta.
   */
  it('la riga dell asta e alta quanto la finestra, col banco a misura fissa', async () => {
    stubApi({ state: STATE });
    renderAuction();
    const row = await screen.findByTestId('auction-row');
    expect(row.className).toContain('lg:h-[max(43.5rem,calc(100dvh-var(--header-h)-var(--commands-h)-2rem))]');
    const center = screen.getByTestId('auction-center');
    expect(center.className).toContain('lg:grid-rows-[3rem_var(--banco-h)_minmax(14.75rem,1fr)]');
  });

  // La tabella non e' piu' sotto la piega: sta nella colonna centrale, sotto il banco.
  it('le schede stanno nella colonna centrale, sotto il banco', async () => {
    stubApi({ state: STATE });
    renderAuction();
    const center = await screen.findByTestId('auction-center');
    expect(within(center).getByRole('tablist', { name: "Sezioni dell'asta" })).toBeInTheDocument();
  });
```

In `PhasePager.test.tsx`:

```tsx
  // Nella riga delle schede: due frecce e il conteggio, stessi nomi per chi ascolta.
  it('compatto: due frecce con lo stesso nome dei bottoni di sempre', () => {
    render(<PhasePager compact offset={0} pageSize={25} total={40} hasPrevious={false} hasNext onPrevious={() => {}} onNext={() => {}} />);
    expect(screen.getByRole('button', { name: 'Pagina successiva' })).toHaveTextContent('›');
    expect(screen.getByRole('button', { name: 'Pagina precedente' })).toBeDisabled();
    expect(screen.getByText('1–25 di 40')).toBeInTheDocument();
  });
```

In `PlayerTable.test.tsx`:

```tsx
  // Dentro il pannello delle schede la tabella scorre da se', e l'intestazione resta
  // ferma in alto: con cinque righe in vista, senza intestazione non si saprebbe
  // quale colonna e' il tetto.
  it('a riempimento scorre dentro di se con l intestazione ferma', () => {
    render(<PlayerTable fill rows={ROWS} selectedId={null} onSelect={() => {}} />);
    const region = screen.getByRole('region');
    expect(region.className).toContain('h-full');
    expect(region.className).toContain('overflow-auto');
    screen.getAllByRole('columnheader').forEach((th) => expect(th.className).toContain('sticky'));
  });
```

(con i dati di prova che il file usa.)

In `RosterGrid.test.tsx`:

```tsx
  // Nel pannello delle schede, alto quanto resta: le rose scorrono nei due sensi, la
  // tua colonna per prima e ferma a sinistra, i nomi delle squadre fermi in alto.
  it('a riempimento la tua colonna e la prima e resta ferma a sinistra', async () => {
    // …stessa preparazione delle altre prove del file…
    render(/* come le altre prove, con <RosterGrid fill /> */);
    const columns = await screen.findAllByRole('region', { name: /Rosa di|rosa/i });
    expect(columns[0].className).toContain('sticky');
    expect(columns[0].className).toContain('left-0');
  });
```

Adattare preparazione, resa e modo di trovare le colonne a come il file le fa già (le colonne sono `<section aria-labelledby="roster-…">`): la prova deve affermare che la colonna con `me` è la prima e porta `sticky left-0`, e che il suo `<h3>` porta `sticky top-0`.

Run: `npm test -- src/routes/AuctionRoute.test.tsx src/domain/PhasePager.test.tsx src/domain/PlayerTable.test.tsx src/domain/RosterGrid.test.tsx`
Expected: FAIL sulle prove nuove.

- [ ] **Step 2: La misura del banco**

In `frontend/src/index.css`, accanto a `--header-h` e `--commands-h`:

```css
/* L'altezza del banco dell'asta, uguale in ogni stato: a riposo, col lotto, col
   conto che corre, a tempo scaduto. Presa dallo stato piu' alto misurato su uno
   screenshot vero (docs/superpowers/decisions): e' l'unico posto in cui cambiarla. */
:root {
  --banco-h: 23.75rem;
}
```

- [ ] **Step 3: Le varianti di pager, tabella e rose**

`PhasePager.tsx` — prop `compact = false`. Con `compact` il `<nav>` prende `className="flex items-center gap-1 text-meta"`, il conteggio sta fra i due bottoni come oggi, e i bottoni diventano:

```tsx
      <button
        type="button"
        onClick={onPrevious}
        disabled={!hasPrevious}
        aria-label="Pagina precedente"
        aria-describedby={previousReason ? previousHintId : undefined}
        className={`flex size-11 items-center justify-center rounded-lg text-lg hover:bg-line disabled:opacity-50 ${FOCUS_RING}`}
      >
        <span aria-hidden="true">‹</span>
      </button>
```

e lo stesso per «Pagina successiva» con `›`. Senza `compact` il componente resta identico a oggi.

`PlayerTable.tsx` — prop `fill = false`. Con `fill`:
- la regione prende `h-full overflow-auto` al posto di `overflow-x-auto rounded-lg border border-line` (il pannello fa già da cornice);
- la `<caption>` prende `sr-only` (la legenda visibile passa nella riga delle schede, Step 4);
- ogni `<th>` prende `sticky top-0 z-10 bg-surface`;
- la tabella passa da `text-sm` a `text-body`, e la cella del tetto prende `font-bold` quando non è «nessuno» né in rosso.
Senza `fill` resta com'è.

`RosterGrid.tsx` — `export function RosterGrid({ fill = false }: { fill?: boolean } = {})`. Con `fill`:
- il contenitore più esterno prende `flex h-full min-h-0 flex-col`, e il contenitore che scorre (`ref={scrollerRef}`) passa da `relative overflow-x-auto` a `relative min-h-0 flex-1 overflow-auto`;
- le colonne sono in ordine con la tua per prima (`[...columns].sort((a, b) => Number(b.me) - Number(a.me))`, senza toccare l'ordine delle altre);
- la colonna con `me` prende `sticky left-0 z-10 bg-surface`, e ogni `<h3>` di colonna prende `sticky top-0 z-[5] bg-surface`;
- la frase «Scorri di lato…» resta.
Senza `fill` (asta conclusa, chi non ha un posto) resta com'è.

- [ ] **Step 4: La griglia**

In `AuctionRoute.tsx`:

1. Entrambi gli `<AppShell chrome="top" …>` della pagina prendono `bleed`, e tutto il loro contenuto va dentro `<div className="p-4 md:p-6 lg:px-5 lg:py-4">`: sotto `lg` i margini restano quelli di oggi, da `lg` la pagina guadagna i 16px che servono alla tabella.
2. La riga dell'asta (`data-testid="auction-row"`) diventa:

```tsx
      <div
        data-testid="auction-row"
        className={`grid grid-cols-1 gap-4 ${
          seated === false
            ? 'lg:grid-cols-[14.5rem_minmax(0,1fr)]'
            : 'lg:h-[max(43.5rem,calc(100dvh-var(--header-h)-var(--commands-h)-2rem))] lg:grid-cols-[14.5rem_minmax(0,1fr)_20.5rem]'
        }`}
      >
```

   Con `seated === false` (il banditore senza posto) la riga resta alta quanto il banco e le rose restano sotto a pagina intera, come oggi: lì non c'è una tabella di fase.
3. La colonna centrale (oggi `<div className="flex min-h-0 min-w-0 flex-col gap-5">`) diventa:

```tsx
        <div
          data-testid="auction-center"
          className={`flex min-h-0 min-w-0 flex-col gap-4 lg:grid ${
            seated === false
              ? 'lg:grid-rows-[3rem_var(--banco-h)]'
              : 'lg:grid-rows-[3rem_var(--banco-h)_minmax(14.75rem,1fr)]'
          }`}
        >
```

4. La ricerca: il suo contenitore `searchActive ? 'flex min-h-0 flex-1 flex-col' : undefined` diventa `searchActive ? 'flex min-h-0 flex-1 flex-col lg:row-span-2' : 'min-h-0'` — mentre si cerca, i risultati prendono il posto del banco e la tabella resta dov'è.
5. Il banco (`<section aria-labelledby={bidderPanelId} className="panel flex min-h-0 flex-1 flex-col p-4">`) resta com'è: la sua altezza la decide la riga della griglia, e il suo contenuto scorre dentro (`overflow-y-auto` c'è già). Aggiungere `data-testid="banco"` alla `<section>` e `data-testid="banco-content"` al `<div className="mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto">` che contiene lotto o riepilogo: servono alle misure del Task 8.
6. Il pannello delle schede si sposta dentro la colonna centrale, come terzo figlio, solo quando `seated !== false`. Oggi sta sotto la riga dell'asta come `<div className="panel mt-4 p-4">`; diventa:

```tsx
          {seated === false ? null : (
            <div className="panel flex min-h-0 flex-col overflow-hidden max-lg:p-4">
              <div className="flex shrink-0 flex-wrap items-center gap-x-4 border-b border-line lg:px-2">
                <div role="tablist" aria-label="Sezioni dell'asta" className="flex gap-1">
                  {/* i due bottoni di scheda, identici a oggi */}
                </div>
                {activeTab === 'fase' && phase.data ? (
                  <div className="ml-auto flex items-center gap-3 text-meta text-muted-foreground">
                    {/* Da xl in su la legenda sta qui, in una riga; sotto va a capo
                        sotto le schede. */}
                    <span className="max-xl:order-last max-xl:basis-full">
                      in <span className="font-medium text-destructive">rosso</span> i tetti che il mercato supera
                    </span>
                    <PhasePager
                      compact
                      offset={phase.data.offset}
                      pageSize={phase.data.pageSize}
                      total={phase.data.total}
                      hasPrevious={phase.data.hasPrevious}
                      hasNext={phase.data.hasNext}
                      onPrevious={() => setPageOffset((o) => Math.max(0, o - phase.data!.pageSize))}
                      onNext={() => setPageOffset((o) => o + phase.data!.pageSize)}
                    />
                  </div>
                ) : null}
              </div>
              <div role="tabpanel" id="tabpanel-fase" aria-labelledby="tab-fase" hidden={activeTab !== 'fase'} className="min-h-0 flex-1 max-lg:mt-4">
                {activeTab === 'fase' ? (
                  <PlayerTable fill /* …le stesse props di oggi… */ />
                ) : null}
              </div>
              <div role="tabpanel" id="tabpanel-rose" aria-labelledby="tab-rose" hidden={activeTab !== 'rose'} className="min-h-0 flex-1 max-lg:mt-4 lg:p-3">
                {activeTab === 'rose' ? <RosterGrid fill /> : null}
              </div>
            </div>
          )}
```

   I bottoni delle schede, i loro `ref`, `role="tab"`, `aria-selected`, `tabIndex`, `onKeyDown` restano identici a oggi; così i commenti che li accompagnano. Il `PhasePager` di oggi sotto la tabella si toglie. Sotto `lg` la tabella non ha un'altezza da riempire: `PlayerTable fill` sotto `lg` deve comportarsi come oggi, quindi le classi della variante `fill` portano il prefisso `lg:` (`lg:h-full lg:overflow-auto`, `lg:sticky`…) — aggiornare di conseguenza le prove dello Step 1 perché cerchino le classi con `lg:`.
7. Il vecchio `<div className="panel mt-4 p-4">` con le schede, sotto la riga dell'asta, si toglie. Quello del ramo `seated === false` con `<RosterGrid />` resta.
8. I due lunghi commenti sull'altezza di oggi («39rem: misurata…», «Altezza DECISA…», «min(): 39rem…») si sostituiscono con uno solo che dice la somma di questo task e dove vive la misura del banco.

- [ ] **Step 5: Vedere le prove passare**

Run: `npm test -- src/routes/AuctionRoute.test.tsx src/domain/PhasePager.test.tsx src/domain/PlayerTable.test.tsx src/domain/RosterGrid.test.tsx`
Expected: PASS. Le prove dell'asta che cercavano il pager sotto la tabella trovano i bottoni per nome accessibile, che non cambia.

Run: `npm test && npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 6: Guardarla**

```bash
npm run screens -- test-results/screens/asta-task7
```

Aprire `13-asta-riposo-desktop.png`, `14-asta-giocatore-desktop.png`, `14b-asta-conto-desktop.png`, `14d-asta-scaduto-desktop.png`, `14c-asta-rose-desktop.png` e `13-asta-riposo-telefono.png`. Da computer: la pagina non scorre, tre colonne, la tabella sotto il banco con almeno quattro righe, il banco della stessa altezza nelle cinque immagini. Da telefono: la pagina come prima di questo piano. Descrivere nel rapporto cosa si vede; un banco il cui contenuto è tagliato o scorre si annota per il Task 8, non si corregge qui.

- [ ] **Step 7: Commit**

```bash
git add -A frontend/src
git commit -m "L'asta alta quanto la finestra: la tabella sotto il banco, nel primo schermo"
```

---

### Task 8: Misurare, fissare il banco, guardare

**Files:**
- Modify: `frontend/scripts/screens.mjs`
- Modify: `frontend/src/index.css` (`--banco-h`, se la misura lo chiede)
- Modify: `docs/superpowers/decisions/2026-09-30-club-notturno-fondamenta.md` (una sezione nuova in fondo)

**Interfaces:**
- Consumes: `data-testid="banco"`, `data-testid="banco-content"` (Task 7).
- Produces: `npm run screens` accetta `SIZES=1440x900,1920x1080,1280x720,390x844` e stampa `traboccano:` e `scorrono:`.

- [ ] **Step 1: Lo script misura**

In `frontend/scripts/screens.mjs`:

1. Le misure vengono da una variabile, con le due di oggi come predefinite e i nomi di oggi per loro:

```js
const SIZES = (process.env.SIZES ?? '1440x900,390x844').split(',').map((s) => {
  const [width, height] = s.split('x').map(Number);
  const tag = s === '1440x900' ? 'desktop' : s === '390x844' ? 'telefono' : s;
  return { viewport: { width, height }, tag };
});
```

   e il ciclo `for (const [vp, tag] of [[DESK, 'desktop'], [PHONE, 'telefono']])` diventa `for (const { viewport: vp, tag } of SIZES)`. Le costanti `DESK` e `PHONE` si tolgono.
2. Due elenchi accanto a `wide`: `const spilling = []; const scrolling = [];`. In `shot`, dopo il controllo della larghezza, solo se il nome comincia con `13` o `14` e `page.viewportSize().width >= 1024`:

```js
    const fit = await page.evaluate(() => {
      const banco = document.querySelector('[data-testid=banco]');
      const content = document.querySelector('[data-testid=banco-content]');
      return {
        banco: banco ? Math.round(banco.getBoundingClientRect().height) : null,
        needed: content ? content.scrollHeight : null,
        shown: content ? content.clientHeight : null,
        pageExtra: document.documentElement.scrollHeight - window.innerHeight,
      };
    });
    if (fit.needed !== null && fit.needed > fit.shown + 1) spilling.push(`${name}: banco ${fit.banco}px, contenuto ${fit.needed}px in ${fit.shown}px`);
    if (fit.pageExtra > 0) scrolling.push(`${name} (+${fit.pageExtra}px)`);
    if (fit.banco !== null) console.log(`   banco ${fit.banco}px, contenuto ${fit.needed}/${fit.shown}px`);
```

3. In fondo: `console.log('traboccano:', spilling); console.log('scorrono:', scrolling);`.

- [ ] **Step 2: Misurare**

```bash
SIZES=1440x900,1920x1080,1280x720,390x844 npm run screens -- test-results/screens/asta-misure
```

Expected: `ok` per ogni schermata, `non gestite: []`. Leggere i valori `contenuto X/Ypx` delle schermate 14, 14b, 14d a 1440×900.

- [ ] **Step 3: Fissare il banco**

Il banco deve contenere il suo stato più alto senza scorrere a 1440×900 e 1920×1080: `traboccano:` vuoto per quelle misure.

- Se una schermata trabocca, alzare `--banco-h` in `index.css` al più alto fra i `contenuto` misurati più i margini del banco (la sua intestazione e il suo padding: la differenza fra `banco` e `shown`), arrotondato al quarto di rem in su. Poi controllare la somma: con il nuovo valore la tabella deve avere ancora almeno 14,75rem a 1440×900 (755 − 48 − 16 − banco − 16 ≥ 236). Se non li ha, il valore non si alza: si accorcia lo stato più alto (per esempio i bottoni squadra a tempo scaduto su una riga sola da `xl`) nel componente che lo disegna, con la sua prova, e si rimisura.
- Se il contenuto più alto è più basso del banco di oltre 24px, abbassare `--banco-h` allo stesso modo: lo spazio va alla tabella.
- Aggiornare la prova di `AuctionRoute.test.tsx` solo se il nome della variabile cambia (non deve).

Rimisurare finché `traboccano:` è vuoto a 1440×900 e 1920×1080 e `scorrono:` non contiene schermate a quelle due misure. A 1280×720 la pagina scorre per costruzione (720 − 145 < 696): annotarlo, non è un difetto.

- [ ] **Step 4: Guardare**

Aprire le schermate 13, 14, 14b, 14d, 14c a 1440×900 e a 1920×1080, e 13 e 14 a 390×844. Per ognuna: il banco ha la stessa altezza e posizione nei cinque stati? Si vedono almeno quattro righe di tabella a 1440×900? L'oro sta solo nei quattro posti dei vincoli globali? Il telefono è come prima di questo piano?

- [ ] **Step 5: Scrivere cosa si è visto**

In fondo a `docs/superpowers/decisions/2026-09-30-club-notturno-fondamenta.md` aggiungere una sezione `## L'asta sul computer — misure finali` con: il valore finale di `--banco-h` e perché; una tabella con, per 1440×900 e 1920×1080, l'altezza del banco, il contenuto più alto misurato per stato (riposo, lotto, conto, tempo scaduto) e quante righe di tabella si vedono; l'esito a 1280×720; ciò che è stato corretto in questo passo e ciò che resta al piano del telefono.

- [ ] **Step 6: Tutto verde, e commit**

```bash
npm test && npm run build && npm run lint
git add frontend/scripts/screens.mjs frontend/src/index.css docs/superpowers/decisions/2026-09-30-club-notturno-fondamenta.md
git commit -m "L'asta sul computer misurata: il banco fissato, le schermate a tre misure"
```

(aggiungere al commit i file dei componenti se lo Step 3 ne ha accorciato uno.)
