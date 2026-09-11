# Ridisegno dell'interfaccia — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rifare il livello di presentazione di FantaAgent seguendo quattro mockup — home, impostazioni, asta — tenendo la palette verde del campo, portando la ricerca per nome dentro il frontend nuovo e assorbendo il riepilogo dentro la schermata d'asta.

**Architecture:** Nessun cambiamento architetturale. Il confine API resta dov'è; l'unica modifica Java è un parametro `role` opzionale su un endpoint che esiste già e il metodo di servizio che lo serve. Tutto il resto è `frontend/src`: una barra laterale al posto della barra superiore, quattro colori di ruolo generati dalla palette, e tre schermate ricostruite attorno alla grammatica dei mockup.

**Tech Stack:** Java 25 / Spring Boot 3.5.6 · Vite + React 19 + TypeScript + Tailwind v4 · TanStack Query · vitest + Testing Library · oxlint · ArchUnit

**Spec:** `docs/superpowers/specs/2026-09-11-ridisegno-interfaccia-design.md`

## Global Constraints

Ogni task eredita implicitamente questa sezione.

- **Solo token, mai colori letterali** nelle classi Tailwind. I colori nascono in `frontend/scripts/palette.mjs` e arrivano in `tokens.css` con `npm run tokens`. `tokens.css` **non si modifica a mano**: è generato, e una modifica manuale muore alla build successiva.
- **La palette non perde colori.** `background`, `surface`, `foreground`, `muted-foreground`, `accent`, `on-accent`, `positive`, `destructive`, `line`, `line-strong` restano tutti. Il task 1 ne aggiunge quattro.
- **Icone SVG inline, mai emoji.** Ogni icona che è un controllo ha un nome accessibile; un'icona decorativa ha `aria-hidden`.
- **Bersagli da almeno 44×44 px** su ogni controllo: `min-h-11` più una larghezza garantita (`min-w-11` o padding), mai la larghezza dedotta dall'auto-layout.
- **`.tnum` su ogni cifra che si incolonna** — budget, prezzi, date, percentuali.
- **Le tre forme dell'annuncio.** Qualificatore di valore: `sr-only` in linea dentro l'elemento del valore. Stato di regione: paragrafo `sr-only` a sé, statico. Stato di controllo: `sr-only` più `aria-describedby` sul controllo. Un segnale che raggiunge solo chi guarda lo schermo è un segnale mancante.
- **Un solo canale `role="status"`** di narrazione ambientale in tutta l'applicazione: `AuctionAnnouncer`. Un `role="alert"` legato a un campo o a una sezione è legittimo, ma **uno alla volta per schermata**.
- **Nessun aggiornamento ottimistico.** Nessun `onMutate` che anticipa la cache.
- **Nessuno stato di dominio nel browser.** Il `BroadcastChannel` porta solo quale lotto, a che prezzo, quanto manca — mai nome, squadra o ruolo.
- **La confidenzialità del tetto resta strutturale in quattro punti**: il record Java `PublicBidderResponse`, il tipo TypeScript omonimo, il tipo `BidBroadcast`, e la regola `no-restricted-imports` in `.oxlintrc.json`. Nessun task ne toglie uno.
- **`src/main/java/com/fantaagent/adapter/in/web` non si tocca.** I suoi 87 test devono restare 87 e verdi a ogni task.
- **Mai eseguire il jar o i test contro la `data/` del progetto.** Usare una directory usa e getta.
- **Mai eseguire le specifiche Playwright casualmente**: scrivono acquisti veri in un registro append-only.
- Comandi di verifica: `cd frontend && npm test`, `npm run build`, `npm run lint`; dalla radice `mvn test`.
- Commenti e messaggi di commit in italiano, come tutto il repository.

## Struttura dei file

**Creati**

| File | Responsabilità |
|---|---|
| `frontend/src/domain/PitchLines.tsx` | Le linee del campo: un SVG decorativo, due tarature |
| `frontend/src/domain/RoleBadge.tsx` | La pillola di ruolo: lettera più colore, mai colore soltanto |
| `frontend/src/domain/SideNav.tsx` | La barra laterale: nome, navigazione, slot di stato |
| `frontend/src/domain/PlayerSearchBox.tsx` | Campo di ricerca più filtri `TUTTI P D C A` |
| `frontend/src/domain/AnalysisPanel.tsx` | Driver, tetto duro, stelle di confidenza |
| `frontend/src/domain/SquadCards.tsx` | La fila di card squadra (sostituisce `LeagueBoard`) |
| `frontend/src/domain/RosterGrid.tsx` | La griglia delle rose con revoca riga per riga (era `RecapRoute`) |
| `frontend/src/domain/ConfigChips.tsx` | I quattro numeri di `LeagueRules`, in sola lettura |
| `frontend/src/api/usePlayerSearch.ts` | Ricerca con attesa della digitazione e guardia sull'ordine delle risposte |

**Eliminati**

| File | Perché |
|---|---|
| `frontend/src/domain/LeagueBoard.tsx` (e il suo test) | Sostituito da `SquadCards`, che porta anche slot e conteggi per ruolo |
| `frontend/src/routes/RecapRoute.tsx` (e il suo test) | Il riepilogo diventa `RosterGrid` dentro `/asta` |

**Modificati:** `frontend/scripts/palette.mjs`, `frontend/src/styles/contrast.test.ts`, `frontend/src/AppShell.tsx`, `frontend/src/router.tsx`, tutte e quattro le rotte superstiti, `PlayerDecisionCard`, `BidPanel`, `PlayerTable`, `PhasePager`, `PhaseSwitcher`, `UndoLastButton`, `ParticipantsFieldset`, `ScoringFieldset`, `ThresholdsTable`, `src/main/java/com/fantaagent/adapter/in/api/PlayerApi.java`, `src/main/java/com/fantaagent/application/service/PlayerSearchService.java`, `README.md`.

---
### Task 1: I quattro colori di ruolo, e le linee del campo

**Files:**
- Modify: `frontend/scripts/palette.mjs`
- Modify: `frontend/src/styles/contrast.test.ts`
- Generated: `frontend/src/styles/tokens.css` (con `npm run tokens`, mai a mano)
- Create: `frontend/src/domain/PitchLines.tsx`
- Create: `frontend/src/domain/PitchLines.test.tsx`
- Create: `frontend/src/domain/RoleBadge.tsx`
- Create: `frontend/src/domain/RoleBadge.test.tsx`

**Interfaces:**
- Produces: i token `role-p`, `role-d`, `role-c`, `role-a` (usabili come `text-role-p`, `bg-role-d`, `border-role-c`); `<PitchLines variant="app" | "projection" />`; `<RoleBadge role={Role} filled?: boolean />`.
- Consumes: niente. È il primo task.

I valori sono già stati verificati contro `background` (#0A1F16) e `surface` (#0E2A1E): rapporti fra 7,96 e 10,22 su fondo, fra 7,09 e 9,11 su superficie, e `on-accent` sopra ciascuno resta fra 8,47 e 10,87. Vanno usati **esattamente questi**.

- [ ] **Step 1: Estendere il test di contrasto (rosso)**

In `frontend/src/styles/contrast.test.ts`, aggiungere all'array `PAIRS`, dopo la coppia `['destructive', 'surface', 4.5]`:

```ts
  // I quattro ruoli escono come testo dentro una pillola e come fascia sopra la
  // griglia delle rose: 4.5, non 3, perche' e' testo piccolo, esattamente come
  // accent, positive e destructive qui sopra.
  ['role-p', 'background', 4.5],
  ['role-p', 'surface', 4.5],
  ['role-d', 'background', 4.5],
  ['role-d', 'surface', 4.5],
  ['role-c', 'background', 4.5],
  ['role-c', 'surface', 4.5],
  ['role-a', 'background', 4.5],
  ['role-a', 'surface', 4.5],
```

E, sotto il blocco `it.each(PAIRS)`, una seconda verifica — la pillola piena porta testo scuro sopra il colore del ruolo:

```ts
  // Nella griglia delle rose la fascia di ruolo e' PIENA e porta la lettera in
  // scuro sopra di se': e' una coppia che il ciclo qui sopra non tocca, perche'
  // li il ruolo e' il fondo e non il testo.
  it.each(['role-p', 'role-d', 'role-c', 'role-a'] as const)(
    'on-accent raggiunge 4.5:1 sopra %s',
    (role) => {
      expect(contrastRatio(PALETTE['on-accent'], PALETTE[role])).toBeGreaterThanOrEqual(4.5);
    },
  );
```

- [ ] **Step 2: Vederlo fallire**

Run: `cd frontend && npm test -- contrast`
Expected: FAIL. `PALETTE['role-p']` è `undefined`, quindi `hexToRgb` fallisce dentro `contrastRatio`. Se invece passasse, la verifica non sta verificando: fermarsi e capire perché.

- [ ] **Step 3: Aggiungere i quattro colori**

In `frontend/scripts/palette.mjs`, dentro `PALETTE`, dopo `destructive`:

```js
  // I quattro ruoli. NON riusano positive e destructive nonostante la
  // somiglianza cromatica (il difensore e' verde, l'attaccante e' rosso): sono
  // coincidenze, non lo stesso significato. Il giorno in cui "positivo"
  // diventasse blu, i difensori non devono seguirlo.
  'role-p':           '#FFA552',
  'role-d':           '#7BDB9E',
  'role-c':           '#7FC4FF',
  'role-a':           '#FF8FA3',
```

- [ ] **Step 4: Rigenerare i token e vedere verde**

Run: `cd frontend && npm run tokens && npm test -- contrast`
Expected: PASS. `tokens.css` ora contiene `--role-p: oklch(…)` e `--color-role-p: var(--role-p);` per tutti e quattro — il test «tokens.css è rigenerato dalla palette corrente» lo verifica da solo, perché scorre `Object.entries(PALETTE)`.

- [ ] **Step 5: Vedere la guardia fallire davvero**

Cambiare temporaneamente `'role-a'` in `'#3A1015'` (un rosso scurissimo), rieseguire `npm run tokens && npm test -- contrast`, e **verificare che il test diventi rosso**. Poi ripristinare `#FF8FA3` e rigenerare.

Riportare nel resoconto il messaggio di fallimento osservato. Una guardia mai vista fallire non è una guardia: nelle tappe precedenti una regola ArchUnit passava a vuoto e una scansione di link non trovava niente.

- [ ] **Step 6: `RoleBadge` — il test prima**

Creare `frontend/src/domain/RoleBadge.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RoleBadge } from './RoleBadge';

describe('RoleBadge', () => {
  it('porta la lettera del ruolo, non solo il colore', () => {
    render(<RoleBadge role="D" />);
    expect(screen.getByText('D')).toBeInTheDocument();
  });

  it('dice per esteso di che ruolo si tratta, per chi non vede il colore', () => {
    render(<RoleBadge role="C" />);
    expect(screen.getByText('centrocampista')).toHaveClass('sr-only');
  });

  it.each([
    ['P', 'role-p'],
    ['D', 'role-d'],
    ['C', 'role-c'],
    ['A', 'role-a'],
  ] as const)('usa il token del ruolo %s', (role, token) => {
    const { container } = render(<RoleBadge role={role} />);
    expect(container.firstElementChild?.className).toContain(token);
  });
});
```

- [ ] **Step 7: Vederlo fallire, poi scrivere `RoleBadge`**

Run: `cd frontend && npm test -- RoleBadge` → FAIL, il modulo non esiste.

Creare `frontend/src/domain/RoleBadge.tsx`:

```tsx
import type { Role } from '../api/types';

const LETTER_CLASS: Record<Role, string> = {
  P: 'text-role-p border-role-p',
  D: 'text-role-d border-role-d',
  C: 'text-role-c border-role-c',
  A: 'text-role-a border-role-a',
};

const FILLED_CLASS: Record<Role, string> = {
  P: 'bg-role-p text-on-accent',
  D: 'bg-role-d text-on-accent',
  C: 'bg-role-c text-on-accent',
  A: 'bg-role-a text-on-accent',
};

const NAME: Record<Role, string> = {
  P: 'portiere',
  D: 'difensore',
  C: 'centrocampista',
  A: 'attaccante',
};

/**
 * La pillola di ruolo. Il colore e la LETTERA insieme, sempre: il colore da solo
 * non dice niente a chi non lo distingue, e i mockup hanno gia' ragione su questo
 * — la lettera sta dentro la pillola in ognuno di loro.
 *
 * <p>Il nome per esteso in {@code sr-only} e' la terza copia dello stesso fatto,
 * ed e' quella che chi ascolta riceve: "D" letto da un sintetizzatore e' una
 * lettera, non un ruolo.
 *
 * <p>{@code filled} e' la fascia piena della griglia delle rose; senza, e' il
 * contorno che appare accanto a un nome. Il testo scuro sopra il pieno e'
 * {@code on-accent}, verificato a 4.5:1 sopra tutti e quattro in contrast.test.ts.
 */
export function RoleBadge({ role, filled = false }: { role: Role; filled?: boolean }) {
  return (
    <span
      className={[
        'inline-flex items-center justify-center rounded-full text-xs font-extrabold',
        filled ? FILLED_CLASS[role] : `border ${LETTER_CLASS[role]}`,
        filled ? 'px-2 py-0.5' : 'h-6 w-6',
      ].join(' ')}
    >
      {role}
      <span className="sr-only">{NAME[role]}</span>
    </span>
  );
}
```

Run: `cd frontend && npm test -- RoleBadge` → PASS.

- [ ] **Step 8: `PitchLines` — il test prima**

Creare `frontend/src/domain/PitchLines.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PitchLines, APP_OPACITY, PROJECTION_OPACITY } from './PitchLines';

describe('PitchLines', () => {
  it('e nascosto a chi ascolta: e decorazione, non contenuto', () => {
    const { container } = render(<PitchLines variant="app" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('non intercetta i clic dei controlli che ci stanno sopra', () => {
    const { container } = render(<PitchLines variant="app" />);
    expect(container.firstElementChild?.className).toContain('pointer-events-none');
  });

  /**
   * Il numero non e' arbitrario ed e' l'unico modo di difenderlo: il test di
   * contrasto misura coppie di token, non una texture sovrapposta, quindi il
   * limite vive qui.
   */
  it("nell'applicazione resta sotto la soglia in cui potrebbe intaccare il testo", () => {
    expect(APP_OPACITY).toBeLessThanOrEqual(0.05);
  });

  it('sulla proiezione puo alzare il tono, perche nessun testo piccolo ci passa sopra', () => {
    expect(PROJECTION_OPACITY).toBeGreaterThan(APP_OPACITY);
  });
});
```

- [ ] **Step 9: Vederlo fallire, poi scrivere `PitchLines`**

Run: `cd frontend && npm test -- PitchLines` → FAIL, il modulo non esiste.

Creare `frontend/src/domain/PitchLines.tsx`:

```tsx
/**
 * Quanto le linee possono farsi vedere, per contesto.
 *
 * <p>Il test di contrasto del progetto misura COPPIE DI TOKEN — un testo sopra un
 * fondo — e non sa niente di una texture disegnata in mezzo ai due. Quel limite non
 * puo' quindi essere verificato li: vive qui, con il suo perche', ed e' fissato da
 * PitchLines.test.tsx. 4% su un fondo verde scurissimo resta dentro il rumore di
 * quantizzazione dello schermo; il testo che ci passa sopra non se ne accorge.
 */
export const APP_OPACITY = 0.04;

/**
 * Sulla proiezione il vincolo cade: lo schermo e' grande, il testo e' enorme, e
 * quella schermata esiste per essere guardata da lontano. Le linee possono
 * finalmente leggersi come linee di un campo invece che come una sfumatura.
 */
export const PROJECTION_OPACITY = 0.1;

/**
 * Le linee del campo: mezzeria, cerchio di centrocampo, due aree di rigore.
 *
 * <p>Non e' una texture applicata sopra il progetto: e' la continuazione del
 * linguaggio che {@code PlayerDecisionCard} aveva gia' cominciato con l'arco
 * d'angolo commentato «una linea di campo, non un ornamento».
 *
 * <p>SVG inline e non un'immagine: il tratto e' {@code --line}, cioe' lo stesso
 * token dei bordi di tutta l'applicazione. Un PNG sarebbe un colore in piu' fuori
 * dalla palette, invisibile al test di contrasto e alla prossima ritinteggiatura.
 */
export function PitchLines({ variant }: { variant: 'app' | 'projection' }) {
  const opacity = variant === 'app' ? APP_OPACITY : PROJECTION_OPACITY;
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <svg
        aria-hidden="true"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        style={{ opacity }}
      >
        <g fill="none" stroke="var(--line-strong)" strokeWidth="2">
          <rect x="20" y="20" width="1160" height="760" />
          <line x1="600" y1="20" x2="600" y2="780" />
          <circle cx="600" cy="400" r="110" />
          <circle cx="600" cy="400" r="4" fill="var(--line-strong)" />
          <rect x="20" y="220" width="180" height="360" />
          <rect x="1000" y="220" width="180" height="360" />
          <rect x="20" y="320" width="70" height="160" />
          <rect x="1110" y="320" width="70" height="160" />
        </g>
      </svg>
    </div>
  );
}
```

Run: `cd frontend && npm test -- PitchLines` → PASS.

- [ ] **Step 10: Suite intera, build, lint**

Run: `cd frontend && npm test && npm run build && npm run lint`
Expected: tutto verde. Nessun altro test cambia: questo task non ha ancora toccato nessuna schermata.

- [ ] **Step 11: Commit**

```bash
git add frontend/scripts/palette.mjs frontend/src/styles/tokens.css frontend/src/styles/contrast.test.ts frontend/src/domain/PitchLines.tsx frontend/src/domain/PitchLines.test.tsx frontend/src/domain/RoleBadge.tsx frontend/src/domain/RoleBadge.test.tsx
git commit -m "Da' un colore ai quattro ruoli, e le linee al campo"
```

---
### Task 2: La barra laterale

**Files:**
- Create: `frontend/src/domain/SideNav.tsx`
- Modify: `frontend/src/AppShell.tsx`
- Modify: `frontend/src/AppShell.test.tsx`
- Modify: `frontend/src/routes/ProjectionRoute.tsx` (solo la prop dello chrome)

**Interfaces:**
- Consumes: `PitchLines` (task 1).
- Produces: `<AppShell chrome="side" | "top" | "none" slotStatus? slotActions? title?>` e, da `SideNav.tsx`, `SECTIONS` più `<SectionLinks orientation="vertical" | "horizontal" />`. `chrome="side"` è la barra laterale (home, impostazioni); `chrome="top"` è la barra compatta dell'asta; `chrome="none"` è la proiezione. `slotActions` ospita i pulsanti icona dell'asta e **appare solo** con `chrome="top"`.

**Perché `/riepilogo` non si tocca qui.** Il riepilogo resta una pagina viva, collegata dalla navigazione, finché il task 7 non ne consegna il sostituto dentro `/asta`. Cancellarlo adesso lascerebbe cinque commit in cui non si può revocare un acquisto né esportare il CSV. Ogni task di questo piano consegna un'applicazione che funziona.

- [ ] **Step 1: Aggiornare il test della barra (rosso)**

In `frontend/src/AppShell.test.tsx`, il test che elenca le rotte raggiungibili diventa parametrico sulle due forme di chrome, e se ne aggiungono tre:

```tsx
  /**
   * Il difetto strutturale delle tappe precedenti: due revisioni consecutive hanno
   * trovato "una rotta aggiunta e nessuno che la collega". La barra e' l'unico
   * elemento che ogni schermata condivide, quindi e' qui che la navigazione vive —
   * qualunque forma prenda, laterale o superiore.
   */
  it.each(['side', 'top'] as const)(
    'con chrome=%s collega ogni rotta del router',
    (chrome) => {
      render(withRouter(<AppShell chrome={chrome}><p>x</p></AppShell>));

      const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
      const reachable = routeDefinitions
        .map((r) => r.path)
        // La proiezione e' l'eccezione voluta: seconda schermata per un proiettore,
        // zero controlli, si apre solo dal suo collegamento in /asta.
        .filter((path) => path !== '/proiezione');

      for (const path of reachable) {
        expect(hrefs).toContain(path);
      }
    },
  );

  it('la barra laterale e quella superiore offrono le STESSE destinazioni', () => {
    const { unmount } = render(withRouter(<AppShell chrome="side"><p>x</p></AppShell>));
    const side = screen.getAllByRole('link').map((a) => a.getAttribute('href')).sort();
    unmount();

    render(withRouter(<AppShell chrome="top"><p>x</p></AppShell>));
    const top = screen.getAllByRole('link').map((a) => a.getAttribute('href')).sort();

    // Due elenchi di sezioni sarebbero due cose da tenere d'accordo: e' un solo
    // elenco reso in due forme, e questo test lo impone.
    expect(top).toEqual(side);
  });

  it('con chrome=none (proiezione) non mostra nessun link, nemmeno il nome', () => {
    render(withRouter(<AppShell chrome="none"><p>x</p></AppShell>));

    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByRole('banner')).toHaveTextContent('FantaAgent');
  });

  /**
   * Non nascosti con CSS: non resi affatto. Un pulsante nascosto alla vista resta
   * raggiungibile da tastiera e dai lettori di schermo, su una schermata che non lo
   * prevede.
   */
  it('i pulsanti azione appaiono solo sulla barra superiore', () => {
    const { unmount } = render(withRouter(
      <AppShell chrome="top" slotActions={<button type="button">Annulla</button>}>
        <p>x</p>
      </AppShell>,
    ));
    expect(screen.getByRole('button', { name: 'Annulla' })).toBeInTheDocument();
    unmount();

    render(withRouter(
      <AppShell chrome="side" slotActions={<button type="button">Annulla</button>}>
        <p>x</p>
      </AppShell>,
    ));
    expect(screen.queryByRole('button', { name: 'Annulla' })).not.toBeInTheDocument();
  });
```

Gli altri test del file (`main`, `banner`, `slotStatus`, «il nome porta alla home») restano, passando `chrome="side"` dove prima non passavano nulla. Il test vecchio `senza la navigazione (proiezione)…` viene sostituito da quello su `chrome="none"` qui sopra.

- [ ] **Step 2: Vederli fallire**

Run: `cd frontend && npm test -- AppShell`
Expected: FAIL — `AppShell` non accetta ancora `chrome` né `slotActions`.

- [ ] **Step 3: Estrarre `SideNav`**

Creare `frontend/src/domain/SideNav.tsx` con l'**unico** elenco di sezioni:

```tsx
import { Link } from 'react-router-dom';

/**
 * Le sezioni che la navigazione collega, oltre alla home a cui porta il nome.
 *
 * <p>Non c'e' /proiezione: si apre solo dal suo collegamento in /asta, verso il
 * secondo schermo. L'assenza e' verificata da AppShell.test.tsx, che la elenca con
 * il suo perche' invece di ignorarla in silenzio.
 *
 * <p>Elenco unico, reso in due forme: un secondo elenco per la barra superiore
 * sarebbe una seconda cosa da tenere d'accordo con questa, ed e' esattamente il
 * tipo di coppia che diverge in silenzio.
 */
export const SECTIONS: Array<{ to: string; label: string }> = [
  { to: '/asta', label: 'Asta' },
  { to: '/riepilogo', label: 'Riepilogo' },
  { to: '/impostazioni', label: 'Impostazioni' },
];

const LINK_BASE =
  'flex min-h-11 items-center rounded-full px-4 font-bold hover:bg-surface'
  + ' focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

export function SectionLinks({ orientation }: { orientation: 'vertical' | 'horizontal' }) {
  const vertical = orientation === 'vertical';
  return (
    <nav
      aria-label="Sezioni"
      className={vertical ? 'flex flex-col gap-1' : 'flex items-center gap-1'}
    >
      {SECTIONS.map((s) => (
        <Link key={s.to} to={s.to} className={`${LINK_BASE} ${vertical ? 'w-full' : ''}`}>
          {s.label}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Riscrivere `AppShell`**

`frontend/src/AppShell.tsx` prende `chrome` al posto di `nav`. La radice porta `<PitchLines variant="app" />` una volta sola, prima di tutto il resto, e `min-h-dvh bg-background text-foreground font-sans`.

| `chrome` | Forma |
|---|---|
| `"side"` | `<div className="flex">`: `<header role="banner">` laterale (`w-56`, `border-r border-line`, colonna) con il nome come `<Link to="/">`, poi `<SectionLinks orientation="vertical" />`, e in fondo (`mt-auto`) lo `slotStatus`. Accanto, `<main role="main" className="flex-1 p-6">` |
| `"top"` | `<header role="banner">` orizzontale: nome come `<Link to="/">`, il `title` se passato, `<SectionLinks orientation="horizontal" />`, e a destra (`ml-auto`) prima `slotActions` poi `slotStatus`. Sotto, `<main role="main" className="p-4">` |
| `"none"` | `<header role="banner">` con il nome come **testo semplice** — nessun link, nessuna navigazione — e lo `slotStatus`. Sotto, il `<main>` |

`slotActions` con `chrome !== 'top'` non viene reso affatto (vedi il test dello Step 1).

Il Javadoc esistente su «perché la navigazione vive qui» va conservato e aggiornato alle tre forme. Il paragrafo sulla proiezione senza chrome resta valido parola per parola, con `nav={false}` sostituito da `chrome="none"`.

- [ ] **Step 5: Vedere verde**

Run: `cd frontend && npm test -- AppShell` → PASS.

- [ ] **Step 6: Aggiornare i quattro chiamanti**

`HomeRoute`, `SettingsRoute` e `RecapRoute` passano `chrome="side"`; `AuctionRoute` passa `chrome="top"`; `ProjectionRoute` sostituisce `nav={false}` con `chrome="none"`. Nient'altro in questi file: le schermate si ridisegnano nei task successivi.

- [ ] **Step 7: Suite intera**

Run: `cd frontend && npm test && npm run build && npm run lint`
Expected: verde. I test delle rotte che asseriscono su ruoli ARIA e su testo continuano a passare — è il motivo per cui questo lavoro è fattibile. Un test che fallisce solo perché il markup è cambiato attorno a un `getByRole` stava verificando il markup: riscriverlo, non aggirarlo.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/AppShell.tsx frontend/src/AppShell.test.tsx frontend/src/domain/SideNav.tsx frontend/src/routes
git commit -m "Mette la navigazione di lato, in una forma sola resa in due modi"
```

---
### Task 3: La home

**Files:**
- Modify: `frontend/src/routes/HomeRoute.tsx`
- Modify: `frontend/src/routes/HomeRoute.test.tsx`

**Interfaces:**
- Consumes: `AppShell chrome="side"` (task 2), `PitchLines` (già dentro `AppShell`).
- Produces: niente che altri task consumino.

**Quello che non cambia, e non è negoziabile.** `startNew()` chiama l'endpoint di uscita e **aspetta la sua conferma** prima di navigare alle impostazioni. Il difetto che quella riga esiste per evitare è documentato nel sorgente e in `HomeController.java:78-86`: senza, confermare le impostazioni **riscrive i partecipanti dell'asta in corso** invece di cominciarne una nuova, in silenzio. Non toccare `startNew`, `resume`, né la composizione di `alertMessage` (un solo `role="alert"`, la mutazione più recente ha la precedenza).

- [ ] **Step 1: I test nuovi (rosso)**

I test comportamentali esistenti in `HomeRoute.test.tsx` **restano tutti**. Aggiungere:

```tsx
  it("il pulsante di creazione e' il piu' prominente, e porta alle impostazioni", async () => {
    // Nel mockup e' la card-eroe: un bersaglio solo, grande, in cima alla colonna.
    // Il test non misura i pixel — misura che esista un comando con quel nome e che
    // faccia la cosa giusta, cioe' lasciare l'asta aperta PRIMA di navigare.
    renderHome({ auctions: [OPEN_AUCTION] });
    await userEvent.click(await screen.findByRole('button', { name: /crea asta/i }));

    await waitFor(() => expect(leaveCalls).toBe(1));
    expect(navigations).toEqual(['/impostazioni']);
  });

  it("l'asta aperta si riconosce anche senza vedere il pallino", async () => {
    renderHome({ auctions: [OPEN_AUCTION, CLOSED_AUCTION] });

    // Il pallino colorato del mockup e' decorazione. Il fatto sta nel testo.
    expect(await screen.findByText('In corso')).toBeInTheDocument();
  });

  it('ogni riga dice fase e acquisti, non solo il nome', async () => {
    renderHome({ auctions: [CLOSED_AUCTION] });

    expect(await screen.findByText(/2 acquisti/)).toBeInTheDocument();
    expect(screen.getByText(/fase/i)).toBeInTheDocument();
  });
```

Adattare `renderHome`, `OPEN_AUCTION`, `CLOSED_AUCTION`, `leaveCalls` e `navigations` agli helper che il file già usa — non inventarne di nuovi se esistono equivalenti.

- [ ] **Step 2: Vederli fallire**

Run: `cd frontend && npm test -- HomeRoute`
Expected: FAIL sul primo — il bottone oggi si chiama «Nuova asta», non «Crea asta». Gli altri due possono già passare: se passano, va bene, stanno pinnando ciò che il ridisegno deve conservare.

- [ ] **Step 3: Ridisegnare `HomeRoute`**

Struttura richiesta dentro `<AppShell chrome="side">`:

```
<h1 className="sr-only">Le tue aste</h1>
<div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
  <div>
    <HeroCard />        {/* card-eroe: martelletto SVG + «Crea asta» */}
    <ul>…righe-pillola…</ul>
  </div>
  <aside>…l'asta aperta, grande, oppure EmptyState…</aside>
</div>
{alertMessage ? <p role="alert">…</p> : null}
```

**La card-eroe**: `rounded-2xl border border-line-strong`, fondo `bg-[radial-gradient(120%_90%_at_20%_0%,var(--color-surface)_0%,var(--color-background)_75%)]`, un martelletto SVG `aria-hidden` a sinistra, e il pulsante `bg-positive text-on-accent rounded-full min-h-11 px-6 font-extrabold` con scritto **Crea asta**. Il pulsante è quello di `startNew`, `disabled={leave.isPending}` come adesso.

**Le righe-pillola**: `rounded-xl border border-line px-4 py-3`, in riga un pallino `aria-hidden` (`bg-positive` se `a.selected`, altrimenti `bg-muted-foreground`), il nome in grassetto, `In corso` in `text-accent` quando `a.selected`, e a seguire fase, acquisti e data in `text-sm text-muted-foreground`. Il pulsante «Riprendi» resta `aria-label={`Riprendi ${a.label}`}`, `min-h-11`, `rounded-full`.

Il commento sul nodo unico che contiene `«{a.purchases} acquisti»` **va conservato insieme al nodo**: `getByText` di Testing Library concatena solo i nodi-testo diretti, e spezzare il numero dal sostantivo renderebbe il test dello Step 1 insoddisfacibile per costruzione. È già successo in questo progetto.

**La colonna destra**: se esiste `auctions.data?.find((a) => a.selected)`, una card grande con nome, fase, acquisti e il suo «Riprendi»; altrimenti l'`EmptyState` esistente con il testo che ha già.

Niente cestino: cancellare un'asta non è un'API che esiste, e il registro è append-only.

- [ ] **Step 4: Verde**

Run: `cd frontend && npm test -- HomeRoute` → PASS, tutti, vecchi e nuovi.

- [ ] **Step 5: Suite, build, lint**

Run: `cd frontend && npm test && npm run build && npm run lint`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/routes/HomeRoute.tsx frontend/src/routes/HomeRoute.test.tsx
git commit -m "Da' alla home la card che comincia un'asta"
```

---

### Task 4: La ricerca per nome

**Files:**
- Modify: `src/main/java/com/fantaagent/application/service/PlayerSearchService.java`
- Modify: `src/main/java/com/fantaagent/adapter/in/api/PlayerApi.java`
- Modify: `src/test/java/com/fantaagent/application/service/PlayerSearchServiceTest.java`
- Modify: `src/test/java/com/fantaagent/adapter/in/api/PlayerApiTest.java`
- Create: `frontend/src/api/usePlayerSearch.ts`
- Create: `frontend/src/api/usePlayerSearch.test.tsx`
- Create: `frontend/src/domain/PlayerSearchBox.tsx`
- Create: `frontend/src/domain/PlayerSearchBox.test.tsx`

**Interfaces:**
- Consumes: `RoleBadge` (task 1), `apiGet` e il tipo `PlayerSummary` (esistenti).
- Produces: `usePlayerSearch(query: string, role: Role | null)` → `{ data: PlayerSummary[] | undefined; isFetching: boolean }`; `<PlayerSearchBox onSelect={(playerId: string) => void} />`. Il task 6 monta `PlayerSearchBox` dentro `AuctionRoute` e collega `onSelect` a `setSelectedId`.

**L'endpoint esiste già.** `GET /api/leagues/{leagueId}/auctions/{auctionId}/players?q=` è in `PlayerApi` dalla tappa 1 e restituisce `List<PlayerDtos.PlayerSummary>`. Manca solo il filtro di ruolo, e manca chi lo chiami dal frontend nuovo. Non creare un endpoint `/search`.

- [ ] **Step 1: Il test del servizio (rosso)**

In `PlayerSearchServiceTest`, usando il fixture che il file già costruisce (`RULES`, `SCORING`, `PARTICIPANTS`, `InMemoryPlayerCatalog`, `JsonlAuctionEventStore` su `@TempDir`):

```java
    /**
     * Il filtro va applicato PRIMA del taglio: nove difensori che si chiamano tutti
     * "Rossi" saturerebbero qualunque finestra di candidati, e un filtro applicato
     * ai risultati gia' tagliati restituirebbe zero attaccanti pur essendocene uno.
     */
    @Test
    void ilFiltroDiRuoloNonSiApplicaAiRisultatiGiaTagliati() {
        List<Player> players = new ArrayList<>();
        for (int i = 0; i < 9; i++) {
            players.add(new Player("d" + i, "Rossi " + i, "Inter", Role.D, 10));
        }
        players.add(new Player("a1", "Rossini", "Roma", Role.A, 10));

        PlayerSearchService service = serviceWith(players);

        assertThat(service.search("rossi", Role.A))
                .extracting(Player::id)
                .containsExactly("a1");
    }

    @Test
    void senzaFiltroLaRicercaSiComportaEsattamenteComePrima() {
        List<Player> players = List.of(
                new Player("d1", "Bastoni", "Inter", Role.D, 20),
                new Player("a1", "Lautaro", "Inter", Role.A, 30));

        PlayerSearchService service = serviceWith(players);

        assertThat(service.search("bast", null)).isEqualTo(service.search("bast"));
    }
```

Estrarre `serviceWith(List<Player>)` come metodo privato del test se il file non ne ha già uno equivalente: **non duplicare** il blocco di costruzione del servizio che i test esistenti usano.

- [ ] **Step 2: Vederlo fallire**

Run: `mvn test -Dtest=PlayerSearchServiceTest`
Expected: errore di compilazione — `search(String, Role)` non esiste.

- [ ] **Step 3: Il metodo nuovo**

In `PlayerSearchService`, accanto a `search(String)` — che **non si tocca**:

```java
    /**
     * Come {@link #search(String)}, ma limitata a un ruolo. Un metodo nuovo e non un
     * parametro aggiunto a quello esistente: {@code search(String)} lo chiamano i
     * controller Thymeleaf in {@code adapter/in/web}, che questo piano lascia intatti
     * apposta perche' facciano da confronto. Cambiarne la firma li costringerebbe a
     * cambiare, e i loro 87 test sono la rete di sicurezza dell'intera migrazione.
     *
     * <p>{@code roleFilter} null significa "tutti", ed e' l'unico caso in cui questo
     * metodo e' equivalente a {@link #search(String)}.
     *
     * <p>La finestra di candidati si allarga quando un ruolo e' richiesto: con il
     * filtro attivo circa tre quarti dei candidati vengono scartati prima di contare,
     * e chiedere al dominio la stessa finestra di sempre restituirebbe un elenco
     * quasi vuoto ogni volta che i primi risultati sono del ruolo sbagliato. E' il
     * motivo per cui il filtro sta QUI e non a valle di {@link #search(String)}.
     */
    public List<Player> search(String query, Role roleFilter) {
        AuctionState state = auction.state();
        Set<String> sold = state.soldPlayerIds();
        int window = roleFilter == null ? SEARCH_LIMIT * 2 : SEARCH_LIMIT * 8;
        return search.search(query, state.currentPhase(), window).stream()
                .filter(p -> !sold.contains(p.id()))
                .filter(p -> roleFilter == null || p.role() == roleFilter)
                .limit(SEARCH_LIMIT)
                .toList();
    }
```

Run: `mvn test -Dtest=PlayerSearchServiceTest` → verde.

- [ ] **Step 4: Il parametro sull'endpoint**

In `PlayerApi`, il metodo `search` diventa:

```java
    @GetMapping
    public List<PlayerDtos.PlayerSummary> search(@PathVariable String leagueId,
                                                 @PathVariable String auctionId,
                                                 @RequestParam(defaultValue = "") String q,
                                                 @RequestParam(required = false) Role role) {
        leagues.check(leagueId);
        auctions.check(auctionId);
        return search.search(q, role).stream().map(PlayerDtos.PlayerSummary::from).toList();
    }
```

**Conseguenza da gestire, non da scoprire:** `PlayerApiTest.setUp` stubba oggi `when(search.search("bast"))`. Il controller ora chiama l'overload a due argomenti, quindi quello stub non risponde più e il test esistente diventa rosso con una lista vuota. Va aggiornato a `when(search.search("bast", null))`, e va aggiunto:

```java
    @Test
    void ilFiltroDiRuoloArrivaAlServizio() throws Exception {
        when(search.search("rossi", Role.A)).thenReturn(List.of(LAUTARO));

        mvc.perform(get("/api/leagues/default/auctions/corrente/players?q=rossi&role=A"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("a1"));

        verify(search).search("rossi", Role.A);
    }
```

dichiarando `LAUTARO` accanto a `BASTONI`. Un ruolo non valido (`?role=X`) deve uscire in `problem+json`, non come stack trace: verificarlo e, se non lo fa già, **fermarsi e segnalarlo** invece di aggiungere un gestore d'errore fuori dal perimetro di questo task.

Run: `mvn test -Dtest=PlayerApiTest` → verde.

- [ ] **Step 5: L'hook, con la guardia sull'ordine delle risposte (rosso)**

`frontend/src/api/usePlayerSearch.test.ts`:

```ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlayerSearch } from './usePlayerSearch';

const calls: string[] = [];
let resolvers: Array<(rows: unknown[]) => void> = [];

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  calls.length = 0;
  resolvers = [];
  vi.stubGlobal('fetch', (input: string) => {
    calls.push(input);
    return new Promise((resolve) => {
      resolvers.push((rows) =>
        resolve(new Response(JSON.stringify(rows), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })));
    });
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('usePlayerSearch', () => {
  it('non interroga il server finche la digitazione non si ferma', async () => {
    const { rerender } = renderHook(({ q }) => usePlayerSearch(q, null), {
      wrapper,
      initialProps: { q: 'm' },
    });
    rerender({ q: 'ma' });
    rerender({ q: 'mar' });

    // Prima che l'attesa scada: nessuna richiesta. Tre tasti in rapida
    // successione sono una richiesta, non tre.
    expect(calls).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(300);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toContain('q=mar');
  });

  /**
   * La rete consegna la risposta di "mar" DOPO quella di "martinez". Mostrare "mar"
   * significherebbe sostituire il risultato giusto con uno vecchio, e chi cerca
   * vedrebbe l'elenco tornare indietro sotto le dita.
   *
   * La guardia non e' scritta a mano: la chiave di query CONTIENE la domanda, quindi
   * una risposta per "mar" non puo' finire nella casella di "martinez". Questo test
   * esiste per impedire che una rifattorizzazione futura tolga la domanda dalla
   * chiave — il momento in cui la guardia sparirebbe senza che nulla diventi rosso.
   */
  it('scarta una risposta arrivata dopo una richiesta piu recente', async () => {
    const { result, rerender } = renderHook(({ q }) => usePlayerSearch(q, null), {
      wrapper,
      initialProps: { q: 'mar' },
    });
    await vi.advanceTimersByTimeAsync(300);
    await waitFor(() => expect(calls).toHaveLength(1));

    rerender({ q: 'martinez' });
    await vi.advanceTimersByTimeAsync(300);
    await waitFor(() => expect(calls).toHaveLength(2));

    // Prima la seconda risposta, poi — in ritardo — la prima.
    resolvers[1]([{ id: 'a1', name: 'Martinez', team: 'Inter', role: 'A', listPrice: 30 }]);
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    resolvers[0]([{ id: 'x9', name: 'Mario', team: 'Roma', role: 'C', listPrice: 5 }]);
    await vi.advanceTimersByTimeAsync(50);

    expect(result.current.data?.[0]?.name).toBe('Martinez');
  });

  it('con query vuota non interroga affatto', async () => {
    renderHook(() => usePlayerSearch('   ', null), { wrapper });
    await vi.advanceTimersByTimeAsync(300);

    // Il server risponde con un elenco vuoto per una query in bianco: chiederglielo
    // sarebbe una richiesta di rete per un risultato gia' noto.
    expect(calls).toHaveLength(0);
  });
});
```

Il file è `.tsx`, non `.ts`, perché `wrapper` contiene JSX. Rinominare di conseguenza anche nell'elenco dei file di questo task.

- [ ] **Step 6: Vederli fallire, poi scrivere l'hook**

`frontend/src/api/usePlayerSearch.ts`:

```ts
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

function useDebounced<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
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
```

Run: `cd frontend && npm test -- usePlayerSearch` → PASS.

- [ ] **Step 7: `PlayerSearchBox` (rosso, poi verde)**

`frontend/src/domain/PlayerSearchBox.test.tsx` verifica:

- il campo ha un'etichetta raggiungibile (`getByRole('searchbox', { name: /cerca giocatore/i })` oppure `getByLabelText`), non un `placeholder` al posto dell'etichetta — un placeholder sparisce appena si scrive;
- i cinque filtri sono un gruppo di `radio` con nome accessibile «Filtra per ruolo», e `TUTTI` è quello iniziale;
- selezionare `A` e cercare produce una chiamata con `role=A`;
- scegliere un risultato invoca `onSelect` con l'identificativo del giocatore;
- mentre la richiesta è in volo lo stato è detto **anche a chi ascolta** — paragrafo `sr-only` statico, non una seconda live region;
- zero risultati mostra una frase, non una lista vuota silenziosa.

Il componente rende: il campo (`type="search"`), i cinque filtri come pillole (`RoleBadge` per i quattro ruoli, testo «Tutti» per il quinto), e i risultati come `<ul>` di `<button>` — ognuno `min-h-11`, con nome, squadra, `RoleBadge` e quotazione in `.tnum`.

- [ ] **Step 8: Tutto verde da entrambi i lati**

Run: `cd frontend && npm test && npm run build && npm run lint`
Run (dalla radice): `mvn test` — deve restare verde per intero, **compresi** gli 87 test di `adapter/in/web`, che questo task non tocca pur cambiando il servizio che quei controller usano. È la verifica che il metodo nuovo è davvero additivo.

- [ ] **Step 9: Commit**

```bash
git add src/main/java/com/fantaagent/application/service/PlayerSearchService.java src/main/java/com/fantaagent/adapter/in/api/PlayerApi.java src/test/java/com/fantaagent/application/service/PlayerSearchServiceTest.java src/test/java/com/fantaagent/adapter/in/api/PlayerApiTest.java frontend/src/api/usePlayerSearch.ts frontend/src/api/usePlayerSearch.test.ts frontend/src/domain/PlayerSearchBox.tsx frontend/src/domain/PlayerSearchBox.test.tsx
git commit -m "Porta la ricerca per nome dentro il frontend nuovo"
```

---
### Task 5: Le impostazioni

**Files:**
- Modify: `src/main/java/com/fantaagent/adapter/in/api/dto/SettingsDtos.java`
- Modify: `src/main/java/com/fantaagent/adapter/in/api/SettingsApi.java`
- Modify: `src/test/java/com/fantaagent/adapter/in/api/SettingsApiTest.java`
- Create: `frontend/src/domain/ConfigChips.tsx`
- Create: `frontend/src/domain/ConfigChips.test.tsx`
- Modify: `frontend/src/api/types.ts`
- Modify: `frontend/src/routes/SettingsRoute.tsx`
- Modify: `frontend/src/routes/SettingsRoute.test.tsx`
- Modify: `frontend/src/domain/ParticipantsFieldset.tsx`
- Modify: `frontend/src/domain/ScoringFieldset.tsx`

**Interfaces:**
- Consumes: `RoleBadge` (task 1), `AppShell chrome="side"` (task 2).
- Produces: `SettingsResponse.rules: { participants: number; budget: number; slots: Record<Role, number> }` lato TypeScript, e `<ConfigChips rules={…} />`.

**Perché l'API cresce di un campo.** I quattro numeri del mockup — crediti, numero squadre, limiti per ruolo — vengono da `LeagueRules`, che è un bean di configurazione. Il frontend non ha **nessun** modo di leggerli: `SettingsResponse` porta battitore, partecipanti, punteggio e `auctionOpen`, e `/state` non è disponibile quando nessuna asta è aperta, che è esattamente la situazione in cui si sta creando un'asta. Senza questo campo i chip mostrerebbero numeri inventati.

Il campo è **di sola lettura**: non entra in `SaveRequest`, e `SettingsApi` non lo scrive mai. Renderlo scrivibile è lavoro del sotto-progetto della persistenza (spec §2.1).

- [ ] **Step 1: Il test dell'API (rosso)**

In `SettingsApiTest`, accanto ai test esistenti:

```java
    /**
     * I numeri di LeagueRules servono alla schermata che CREA un'asta, cioe' quando
     * /state risponde 409 perche' nessuna asta e' aperta: questo endpoint e' l'unico
     * posto da cui il frontend puo' leggerli in quel momento.
     */
    @Test
    void leImpostazioniPortanoINumeriDiConfigurazione() throws Exception {
        mvc.perform(get("/api/leagues/default/settings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rules.budget").value(500))
                .andExpect(jsonPath("$.rules.participants").value(8))
                .andExpect(jsonPath("$.rules.slots.P").value(3));
    }
```

I valori attesi sono quelli del profilo `dev` che il test usa: **leggerli da `application-dev.yml` e usare quelli**, non i numeri scritti qui, che sono di esempio.

- [ ] **Step 2: Vederlo fallire, poi aggiungere il campo**

Run: `mvn test -Dtest=SettingsApiTest` → FAIL, `$.rules` non esiste.

In `SettingsDtos`:

```java
    /**
     * I numeri che vengono da {@code application.yml} e non da questa schermata:
     * l'interfaccia li mostra in sola lettura, con l'etichetta che dice da dove
     * vengono. Non compaiono in {@link SaveRequest} apposta — un campo che il
     * server non sa scrivere non deve poter essere inviato.
     */
    public record LeagueRulesView(int participants, int budget, Map<Role, Integer> slots) {

        public static LeagueRulesView from(LeagueRules rules) {
            return new LeagueRulesView(rules.participants(), rules.budget(), rules.slots());
        }
    }
```

e `SettingsResponse` guadagna `LeagueRulesView rules` come ultimo componente. `Role` e `Map` sono già importati nel file; `com.fantaagent.domain.league.LeagueRules` no, e va aggiunto. `SettingsApi` riceve `LeagueRules` nel costruttore e lo passa a `LeagueRulesView.from`. Aggiornare ogni costruzione di `SettingsResponse` e ogni chiamata al costruttore di `SettingsApi` nei test.

Run: `mvn test -Dtest=SettingsApiTest` → verde. Poi `mvn test` intero.

- [ ] **Step 3: Lo specchio TypeScript**

In `frontend/src/api/types.ts`, aggiungere `LeagueRulesView` e il campo `rules: LeagueRulesView` in `SettingsResponse`, con un commento che dice che **non** entra in `SaveSettingsRequest`.

- [ ] **Step 4: `ConfigChips` (rosso, poi verde)**

`ConfigChips.test.tsx` verifica:

- i numeri appaiono con la loro etichetta («crediti», «squadre»), non nudi — è il debito «il numero del budget è nudo, senza etichetta né unità», che non va reintrodotto dalla porta del ridisegno;
- **non** esistono controlli: `queryAllByRole('textbox')` e `queryAllByRole('spinbutton')` sono vuoti. Un `<input disabled>` prometterebbe che un giorno si potrà scrivere, e non è vero;
- la provenienza è detta a parole, raggiungibile da chi ascolta: il gruppo ha un nome accessibile che contiene «configurazione».

Il componente rende un `<section aria-labelledby>` con titolo «Dalla configurazione», i due numeri grandi in pillola `.tnum`, e i quattro slot come `RoleBadge` più il numero.

- [ ] **Step 5: Ridisegnare `SettingsRoute`**

Dentro `<AppShell chrome="side">`:

```
<div className="mx-auto max-w-4xl">
  <header>  ‹ indietro   <h1>Crea asta</h1>  </header>
  <input name asta, grande, centrato>
  <div className="grid gap-4 md:grid-cols-3">  timer · beep · ConfigChips  </div>
  <ParticipantsFieldset />
  <details>  ScoringFieldset  </details>
  <button conferma, verde, centrato>
</div>
```

- il titolo è `Crea asta` quando nessuna asta è aperta, `Impostazioni` quando ce n'è una: la schermata non deve promettere di creare qualcosa mentre sta modificando;
- la freccia indietro è un `<Link to="/">` con nome accessibile, non un'icona muta;
- il pulsante di conferma è `bg-positive text-on-accent rounded-full min-h-11 px-8 font-extrabold`;
- i controlli a pillola sono `rounded-full border border-line-strong min-h-11`.

**La disclosure del punteggio deve aprirsi quando contiene errori.** Un `<details>` chiuso con dentro un campo invalido è un modulo che rifiuta di salvare senza dire perché. Il `open` si calcola dagli errori: se una chiave di `errors` appartiene al punteggio (tutte tranne `auctionName`, `bidTimerSeconds`, `bidder`, `participants` e `participants[…]`), la sezione è aperta.

Test da aggiungere in `SettingsRoute.test.tsx`:

```tsx
  it('apre le regole di punteggio quando un errore ci vive dentro', async () => {
    // 422 con errors: { defendersCounted: ['…'] }
    // Il campo deve essere raggiungibile subito, senza che l'utente debba
    // indovinare quale sezione chiusa lo nasconde.
    expect(await screen.findByRole('group', { name: /punteggio/i })).toBeVisible();
    expect(screen.getByText(/difensori conteggiati/i)).toBeVisible();
  });

  it('le tiene chiuse quando gli errori stanno altrove', async () => {
    // 422 con errors: { auctionName: ['…'] }
  });
```

Tutti i test comportamentali esistenti di `SettingsRoute.test.tsx` restano: l'ordine di scrittura, gli errori per campo, il blocco del punteggio ad asta aperta.

- [ ] **Step 6: Ripulire `ParticipantsFieldset` e `ScoringFieldset`**

Solo presentazione: pillole arrotondate, `RoleBadge` dove il ruolo compare, bersagli da 44 px. **Non** toccare: l'iniziale in un campo proprio, le chiavi d'errore `participants[<id>].name` / `.initial`, il ripiego di `newParticipantId` per il contesto non sicuro, la `<legend>` come nome accessibile del `fieldset`.

- [ ] **Step 7: Tutto verde**

Run: `cd frontend && npm test && npm run build && npm run lint`
Run (dalla radice): `mvn test`

- [ ] **Step 8: Commit**

```bash
git add src/main/java/com/fantaagent/adapter/in/api src/test/java/com/fantaagent/adapter/in/api/SettingsApiTest.java frontend/src/api/types.ts frontend/src/domain/ConfigChips.tsx frontend/src/domain/ConfigChips.test.tsx frontend/src/domain/ParticipantsFieldset.tsx frontend/src/domain/ScoringFieldset.tsx frontend/src/routes/SettingsRoute.tsx frontend/src/routes/SettingsRoute.test.tsx
git commit -m "Fa dire alle impostazioni quali numeri non puo' cambiare"
```

---
### Task 6: La schermata d'asta — barra, ricerca, lotto, analisi

**Files:**
- Create: `frontend/src/domain/AnalysisPanel.tsx`
- Create: `frontend/src/domain/AnalysisPanel.test.tsx`
- Modify: `frontend/src/domain/PlayerDecisionCard.tsx`, `.test.tsx`
- Modify: `frontend/src/domain/PhaseSwitcher.tsx`, `UndoLastButton.tsx`, `BidPanel.tsx`, `PlayerTable.tsx`, `PhasePager.tsx`
- Modify: `frontend/src/routes/AuctionRoute.tsx`, `.test.tsx`
- Modify: `frontend/.oxlintrc.json`

**Interfaces:**
- Consumes: `PlayerSearchBox` (task 4), `AppShell chrome="top" slotActions` (task 2), `RoleBadge` (task 1).
- Produces: `<AnalysisPanel valuation={ValuationResponse} />`. Il task 7 sostituisce il blocco dei tabelloni in fondo a questa schermata.

**La regola di lint cresce insieme al componente nuovo.** `AnalysisPanel` mostra `maxBid`, `hardCap` e i driver: è esattamente la classe di componenti che la proiezione non può importare. Aggiungerlo al gruppo di `no-restricted-imports` in `.oxlintrc.json`, accanto a `**/PlayerDecisionCard*` e `**/BidderDialog*`. Dimenticarlo lascerebbe la garanzia a tre punti su quattro senza che nulla diventi rosso.

**Quello che non cambia.** La logica di `AuctionRoute` — l'annuncio composto dopo la conferma del server, `assign.reset()` al cambio di selezione, il battitore che si chiude su un'aggiudicazione riuscita, `useIdleHeartbeat(bidderOpen)`, la tabella bloccata mentre il battitore è aperto, il ritorno a pagina 1 al cambio fase — resta riga per riga. Questo task muove componenti, non comportamento.

- [ ] **Step 1: `AnalysisPanel` (rosso)**

`AnalysisPanel.test.tsx` verifica:

```tsx
  it('mostra il tetto duro, che nessuna schermata ha mai mostrato', () => {
    render(<AnalysisPanel valuation={{ ...VALUATION, hardCap: 90 }} />);
    expect(screen.getByTestId('hard-cap')).toHaveTextContent('90');
  });

  /**
   * Le stelle sono un'immagine. La confidenza deve arrivare anche a chi non le vede,
   * e "3" letto da un sintetizzatore non e' una confidenza: serve la frase.
   */
  it('dice la confidenza a parole, non solo in stelle', () => {
    render(<AnalysisPanel valuation={{ ...VALUATION, confidenceStars: 3 }} />);
    expect(screen.getByRole('img', { name: /confidenza 3 su 5/i })).toBeInTheDocument();
  });

  it('spiega i driver, saltando quelli senza spiegazione', () => {
    // drivers con explanation vuota non producono ne' un punto isolato ne' una
    // virgola doppia: e' il filtro che PlayerDecisionCard aveva gia', e che si
    // sposta qui insieme al testo.
  });

  it('non e una live region: la pagina ne ha gia una sola', () => {
    const { container } = render(<AnalysisPanel valuation={VALUATION} />);
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
```

- [ ] **Step 2: Scriverlo, e spostare i driver**

`AnalysisPanel` prende `valuation` e rende un `<section aria-labelledby>` con: il titolo «Perché questo prezzo», il tetto duro con la sua etichetta (`data-testid="hard-cap"`, `.tnum`), la confidenza come `role="img"` con `aria-label={`confidenza ${n} su 5`}` e cinque stelle SVG `aria-hidden`, e i driver come `<dl>` — etichetta, contributo, spiegazione.

Il testo dei driver **si sposta** da `PlayerDecisionCard` a qui, con il filtro sulle spiegazioni vuote e il suo commento. Non lasciarlo in entrambi: lo stesso testo in due punti della stessa schermata è rumore, e chi ascolta lo sentirebbe due volte.

`PlayerDecisionCard` conserva: nome, ruolo e squadra, il tetto grande, mercato, margine, il verdetto «Prendi/Lascia», `walkAwayReason` sotto il verdetto, e lo stato stantio con il suo paragrafo `sr-only`. I test che asseriscono su quei fatti restano; quello sui driver si sposta in `AnalysisPanel.test.tsx`.

- [ ] **Step 3: La regola di lint**

In `frontend/.oxlintrc.json`, nel gruppo del primo pattern:

```json
              "group": ["**/PlayerDecisionCard*", "**/BidderDialog*", "**/AnalysisPanel*"],
```

- [ ] **Step 4: Vedere fallire la regola di lint**

Aggiungere temporaneamente `import { AnalysisPanel } from '../domain/AnalysisPanel';` in `frontend/src/routes/ProjectionRoute.tsx`, eseguire `npm run lint`, e **verificare che diventi rosso** con il messaggio della regola. Togliere l'import. Ripetere la stessa prova su `PublicBidderDialog.tsx`, che è l'altro file protetto.

Riportare entrambi i messaggi nel resoconto. Una regola mai vista fallire non è una regola.

- [ ] **Step 5: Ricomporre `AuctionRoute`**

La barra superiore, via `AppShell chrome="top"`:

- `title`: il nome dell'asta da `state.data?.auctionName`;
- `slotActions`: `PhaseSwitcher` come controllo segmentato, poi tre pulsanti icona — «Apri la proiezione sul secondo schermo» (un `<a target="_blank" rel="noopener noreferrer">` verso `/proiezione`), `UndoLastButton`, e un `<Link to="/impostazioni">`. Ogni icona è SVG `aria-hidden` accompagnata da un testo `sr-only` che la nomina, e il bersaglio è 44×44;
- `slotStatus`: `ConnectionStatus`, invariato.

Il corpo:

```
<h1 className="sr-only">Asta</h1>
<AuctionAnnouncer message={announcement} />
<PlayerSearchBox onSelect={setSelectedId} />
<div className="mt-5 grid gap-5 lg:grid-cols-[1fr_22rem]">
  <PlayerDecisionCard …>{ bidderOpen ? <BidderDialog/> : <>bottone battitore + <BidPanel/></> }</PlayerDecisionCard>
  { valuation.data ? <AnalysisPanel valuation={valuation.data} /> : null }
</div>
<PlayerTable … /> <PhasePager … />
<LeagueBoard … />   {/* sostituito dal task 7 */}
```

`PlayerSearchBox` riceve `onSelect={setSelectedId}` — **la stessa** selezione della tabella di fase, non un secondo percorso. Un giocatore scelto dalla ricerca deve comportarsi in tutto come uno scelto dalla tabella: valutazione, battitore, aggiudicazione.

Quando `valuation.data` è assente resta l'`EmptyState`, con il testo aggiornato al fatto che ora si può anche cercare.

- [ ] **Step 6: Un test che la ricerca e la tabella scelgono davvero la stessa cosa**

In `AuctionRoute.test.tsx`:

```tsx
  it('un giocatore scelto dalla ricerca si comporta come uno scelto dalla tabella', async () => {
    // Cerca, clicca il risultato, e verifica che la scheda di decisione mostri
    // QUEL giocatore e che "Aggiudica" scriva il suo identificativo — non che la
    // ricerca abbia un percorso di acquisto tutto suo.
  });
```

- [ ] **Step 7: Ripulire i componenti ereditati**

`PhaseSwitcher`, `UndoLastButton`, `BidPanel`, `PlayerTable`, `PhasePager`: solo presentazione. Pillole e card arrotondate, `RoleBadge` dove compare un ruolo, bersagli garantiti — la larghezza del bersaglio tattile nella tabella di fase **non** deve tornare a dipendere dall'auto-layout, che era un debito chiuso apposta.

Conservare parola per parola: il `disabledReason` di `BidPanel` con le sue due situazioni distinte, la risincronizzazione di `participantId`, il `touched` che impedisce al prezzo di riscriversi sotto le dita, e i `key={valuation.data.playerId}` su `BidPanel` e `BidderDialog`.

- [ ] **Step 8: Tutto verde**

Run: `cd frontend && npm test && npm run build && npm run lint`

- [ ] **Step 9: Commit**

```bash
git add frontend/src/domain frontend/src/routes/AuctionRoute.tsx frontend/src/routes/AuctionRoute.test.tsx frontend/.oxlintrc.json
git commit -m "Mette la ricerca al centro dell'asta, e dice perche' quel prezzo"
```

---

### Task 7: Le rose, dove prima c'era il riepilogo

**Files:**
- Create: `frontend/src/domain/SquadCards.tsx`, `.test.tsx`
- Create: `frontend/src/domain/RosterGrid.tsx`, `.test.tsx`
- Delete: `frontend/src/domain/LeagueBoard.tsx`, `.test.tsx`
- Delete: `frontend/src/routes/RecapRoute.tsx`, `.test.tsx`
- Modify: `frontend/src/routes/AuctionRoute.tsx`, `.test.tsx`
- Modify: `frontend/src/router.tsx`
- Modify: `frontend/src/domain/SideNav.tsx`
- Modify: `frontend/src/AppShell.test.tsx`
- **Non** modificare: `src/main/java/com/fantaagent/adapter/in/spa/SpaRoutesController.java`

**Interfaces:**
- Consumes: `useBoard`, `useVoidPurchase`, `auctionExportUrl` (esistenti), `RoleBadge` (task 1).
- Produces: `<SquadCards participants={ParticipantView[]} />`, `<RosterGrid />` (legge `useBoard` da sé, come faceva `RecapRoute`).

**Perché `SpaRoutesController` non si tocca.** `/riepilogo` deve **restare** nel suo elenco: un ricaricamento profondo su quell'indirizzo deve ricevere `index.html`, e solo allora il router del client reindirizza. Toglierlo darebbe 404 invece del reindirizzamento. Il test `leRotteDelServerCoincidonoConQuelleDelRouterReact` legge `router.tsx` con l'espressione `path:\s*'([^']+)'` e pretende insiemi uguali: finché `/riepilogo` resta una `path` nel router — anche con un `<Navigate>` come elemento — i due elenchi coincidono.

- [ ] **Step 1: `SquadCards` (rosso)**

Il test riprende ciò che `LeagueBoard.test.tsx` già garantisce, e aggiunge ciò che il mockup porta:

```tsx
  it('dice a parole com e composta la rosa, non solo con la barra', () => {
    // La stessa garanzia di LeagueBoard: compositionText resta, perche' e' cio'
    // che permette di togliere "1P 3D 0C 0A" dallo schermo senza perderlo.
    expect(screen.getByRole('img', { name: /1 portiere su 3/ })).toBeInTheDocument();
  });

  it('dice "sei tu" a parole, non solo con il bordo', () => {
    expect(screen.getByText(', sei tu')).toHaveClass('sr-only');
  });

  it('il budget ha la sua etichetta: non e un numero nudo', () => {
    // Debito chiuso nelle tappe precedenti. Non va riaperto dal ridisegno.
    expect(screen.getByTestId('budget-p1')).toHaveTextContent(/crediti/i);
  });

  it('mostra gli slot occupati sul totale, e i conteggi per ruolo', () => {
    expect(screen.getByText('0/25')).toBeInTheDocument();
  });
```

`compositionText` si sposta da `LeagueBoard.tsx` a `SquadCards.tsx` **con il suo commento**, incluso quello sul `?? 0` («non è difesa contro un caso che il tipo esclude: quel che arriva sul filo è JSON»).

Il totale degli slot si conta sulla mappa **di quel partecipante**, non su quella di un altro preso a caso dall'array — il commento che lo spiega si sposta anche lui.

**Nessun «MAX»**: il massimo offribile non arriva dall'API, e ricavarlo qui metterebbe una regola di lega nel browser (spec §2.2).

- [ ] **Step 2: Scrivere `SquadCards`, cancellare `LeagueBoard`**

Card `rounded-xl border p-3` in una fila scorrevole orizzontalmente (`overflow-x-auto`), `border-accent` su quella di «tu». Dentro: nome, budget grande in `.tnum` con la sua etichetta, la barra di riempimento (il `role="img"` con `aria-label={compositionText(p)}` che esisteva già), `slot occupati/totali`, e i quattro conteggi per ruolo come `RoleBadge` più numero.

Cancellare `LeagueBoard.tsx` e il suo test solo **dopo** che i test di `SquadCards` passano.

- [ ] **Step 3: `RosterGrid` (rosso)**

Il test riprende ciò che `RecapRoute.test.tsx` garantiva — trasportarlo, non reinventarlo:

```tsx
  it('revoca solo la riga in volo, non tutte', async () => {
    // `voidPurchase.isPending` da solo e' un booleano UNICO condiviso da ogni riga
    // di ogni colonna: il difetto che pendingSeq esiste per evitare.
  });

  it("manda il seq all'asta che LA BOARD ha letto, non a quella della finestra", async () => {
    // seq e' un numero per registro. Una finestra lasciata aperta su un'asta
    // mentre altrove se ne apre un'altra lo manderebbe al registro sbagliato.
  });

  it("l'esportazione e un link da scaricare, non una fetch", () => {
    const link = screen.getByRole('link', { name: /csv/i });
    expect(link).toHaveAttribute('download');
    expect(link.getAttribute('href')).toContain('/export.csv');
  });

  it('una sola frase di errore alla volta', () => {
    // L'errore della revoca ha la precedenza su quello di caricamento: e' la
    // risposta al gesto piu' recente.
  });

  it('le sezioni di ruolo si possono chiudere, e dicono quanto sono piene', () => {
    expect(screen.getByRole('button', { name: /portieri.*1 su 3/i })).toBeInTheDocument();
  });
```

- [ ] **Step 4: Scrivere `RosterGrid`**

Una colonna per `BoardColumn`, e dentro ogni colonna le quattro sezioni di ruolo: fascia piena (`RoleBadge filled`), la percentuale di riempimento, e un `<button>` che apre e chiude la sezione — `aria-expanded`, e un nome accessibile che dice **ruolo e riempimento**, non solo un chevron.

Le righe sono una `<table>` per colonna, con `<caption className="sr-only">` che nomina il partecipante e intestazioni di colonna vere: è una tabella, non una griglia di `<div>`. Le righe-slot vuote del mockup si rendono come righe con un trattino e un testo `sr-only` «posto libero».

Il Javadoc di `RecapRoute` su «legge da `/board`, che porta già esattamente questi dati» si sposta qui: è la ragione per cui questa parte della schermata **non può** mostrare per sbaglio un prezzo consigliato accanto a uno pagato.

- [ ] **Step 5: Le schede, e il montaggio in `AuctionRoute`**

Sostituire `<LeagueBoard>` con: `<SquadCards participants={…} />`, poi una striscia di schede — `Fase corrente` e `Rose squadre` — con l'esportazione CSV all'estremità, e sotto il pannello della scheda attiva.

Le schede vanno rese come `role="tablist"` / `role="tab"` / `role="tabpanel"` con `aria-controls` e `aria-selected`, e la freccia destra/sinistra deve spostare la selezione: un gruppo di bottoni che non si comporta da schede è peggio di due titoli.

Perché una scheda e non una sezione sempre in vista: la fila di card squadra basta a sapere chi ha quanto, e la griglia intera — otto colonne per venticinque righe — spingerebbe la card del lotto fuori dallo schermo proprio mentre si sta aggiudicando.

- [ ] **Step 6: Il reindirizzamento, e la rimozione del riepilogo**

In `frontend/src/router.tsx`: togliere l'import di `RecapRoute`, aggiungere `Navigate`, e sostituire la voce con:

```tsx
  // Non una destinazione: un indirizzo che ha funzionato, e che deve continuare a
  // portare da qualche parte. Il riepilogo ora vive DENTRO /asta, nella scheda
  // "Rose squadre".
  //
  // La `path` resta dichiarata qui apposta: SpaRoutesControllerTest legge questo file
  // con l'espressione path:\s*'([^']+)' e pretende che l'elenco coincida con
  // SpaRoutesController.ROUTES. Togliere la riga farebbe fallire quel test e — peggio —
  // un ricaricamento profondo su /riepilogo darebbe 404 invece del reindirizzamento,
  // perche' il server non inoltrerebbe piu' index.html.
  { path: '/riepilogo', element: <Navigate to="/asta" replace /> },
```

Togliere `/riepilogo` da `SECTIONS` in `SideNav.tsx`, e aggiungere in `AppShell.test.tsx` la seconda esclusione, con il suo perché:

```tsx
        // /riepilogo e' la seconda eccezione, e di natura diversa dalla prima: non e'
        // piu' una destinazione ma un reindirizzamento verso /asta, tenuto vivo perche'
        // e' nel README e nei segnalibri di chi l'ha usato. Collegare un
        // reindirizzamento offrirebbe due voci di menu per la stessa schermata.
        .filter((path) => path !== '/riepilogo')
```

Cancellare `RecapRoute.tsx` e `RecapRoute.test.tsx`.

- [ ] **Step 7: Vedere fallire la guardia sui due elenchi**

Togliere temporaneamente la riga `{ path: '/riepilogo', … }` da `router.tsx`, eseguire `mvn test -Dtest=SpaRoutesControllerTest`, e **verificare che diventi rossa**. Rimetterla. Riportare il messaggio osservato.

- [ ] **Step 8: Tutto verde, da entrambi i lati**

Run: `cd frontend && npm test && npm run build && npm run lint`
Run (dalla radice): `mvn test`

- [ ] **Step 9: Commit**

```bash
git add frontend/src
git rm frontend/src/domain/LeagueBoard.tsx frontend/src/domain/LeagueBoard.test.tsx frontend/src/routes/RecapRoute.tsx frontend/src/routes/RecapRoute.test.tsx
git commit -m "Porta le rose sotto la ricerca, e il riepilogo dentro l'asta"
```

---
### Task 8: La proiezione, e il README che dice la verità

**Files:**
- Modify: `frontend/src/routes/ProjectionRoute.tsx`, `.test.tsx`
- Modify: `frontend/src/domain/PublicBidderDialog.tsx`, `.test.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: `PitchLines variant="projection"` (task 1), `RoleBadge` (task 1).
- Produces: niente.

**Il vincolo permanente.** Zero pulsanti, zero caselle di testo, **mai** il prezzo consigliato. `chrome="none"` continua a far sparire anche il nome-come-link. La garanzia della confidenzialità resta strutturale in quattro punti — il record Java `PublicBidderResponse`, il tipo TypeScript omonimo, il tipo `BidBroadcast`, la regola `no-restricted-imports` — e questo task non ne tocca nessuno.

**Quello che non cambia.** `canReceive` resta calcolato come adesso: `hasChannel && !isStale(…)`. «Poter ricevere» non è «il browser supporta BroadcastChannel» — quell'API non attraversa mai due dispositivi, e la sola prova onesta di essere in ascolto è aver sentito qualcosa di recente. Le due segnalazioni di staleness — canale e server — restano indipendenti e mostrate separatamente, e nessuna delle due frasi afferma la freschezza dell'altra fonte.

- [ ] **Step 1: I test che pinnano il vincolo (devono già passare)**

In `ProjectionRoute.test.tsx`, se non ci sono già:

```tsx
  it('non offre nessun controllo, nemmeno dopo il ridisegno', () => {
    // Il vincolo permanente, riaffermato nel momento in cui la schermata cambia
    // forma: e' quando si ridisegna che un pulsante ci finisce per comodita'.
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
```

Run: `cd frontend && npm test -- ProjectionRoute` → devono passare prima di toccare il componente. Se falliscono **adesso**, il difetto esiste già e va segnalato prima di ridisegnare sopra.

- [ ] **Step 2: Ridisegnare**

- `<PitchLines variant="projection" />`: sulla proiezione le linee possono leggersi come linee, perché nessun testo piccolo ci passa sopra;
- le colonne dei tabelloni diventano card `rounded-xl`, con le sezioni di ruolo a fascia piena (`RoleBadge filled`) come nella griglia dell'asta, ma **senza** revoca e senza chevron: non è un controllo, è uno schermo;
- il lotto corrente (`PublicBidderDialog`) va al centro, grande: nome, squadra, ruolo, prezzo e countdown in cifre enormi, `.tnum`;
- tipografia sovradimensionata: si legge da sei metri.

Restano: l'`h1` `sr-only`, l'avviso quando il canale non riceve (con il suo testo che non afferma nulla sui tabelloni), il `role="alert"` puntuale sull'errore di caricamento, e l'`EmptyState` quando la lega è vuota.

- [ ] **Step 3: Verificare la confidenzialità sul sorgente, non sui resoconti**

```bash
grep -rn "maxBid\|hardCap\|expectedPrice\|margin\|worthPursuing\|confidenceStars" \
  frontend/src/routes/ProjectionRoute.tsx frontend/src/domain/PublicBidderDialog.tsx \
  frontend/src/domain/bidChannel.ts
```

Expected: **nessun risultato**. Se ne esce anche uno solo, fermarsi.

Poi, di nuovo, la prova che la regola è viva: aggiungere temporaneamente a `ProjectionRoute.tsx` un `import type { ValuationResponse } from '../api/types';`, eseguire `npm run lint`, verificare il rosso, togliere l'import.

- [ ] **Step 4: Il README**

Due correzioni, entrambe di fatti che il ridisegno cambia:

1. La ricerca per nome **non richiede più `/legacy`**: il frontend nuovo la offre al centro della schermata d'asta. Il README deve nominare **solo** il pannello obiettivi fra le cose che ancora obbligano a passare di là.
2. Se il README nomina `/riepilogo` come pagina, va detto che ora è la scheda «Rose squadre» dentro `/asta`, e che l'indirizzo vecchio reindirizza.

Non aggiungere niente che non sia stato verificato eseguendo l'applicazione.

- [ ] **Step 5: La verifica che conta**

Non è che i test passino. È che l'applicazione impacchettata si apra e funzioni:

```bash
mvn clean -Pprod package
java -jar target/*.jar --fantaagent.data-dir=/tmp/fantaagent-verifica
```

`mvn clean` non è opzionale: senza, `-Pprod` lascia in `target/classes/static` gli asset della build precedente, e si finisce per verificare la versione vecchia credendo di verificare quella nuova. **Mai** puntare alla `data/` del progetto.

Aprire `http://localhost:8080` e percorrere il giro completo: creare un'asta dalle impostazioni, cercare un giocatore per nome, aprire il battitore, aggiudicare, aprire la scheda «Rose squadre», revocare, scaricare il CSV, aprire la proiezione in una seconda finestra e verificare che il lotto vi compaia e che **nessun prezzo consigliato** sia visibile.

Riportare che cosa si è visto, non che cosa ci si aspettava.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/routes/ProjectionRoute.tsx frontend/src/routes/ProjectionRoute.test.tsx frontend/src/domain/PublicBidderDialog.tsx frontend/src/domain/PublicBidderDialog.test.tsx README.md
git commit -m "Da' alla proiezione le linee del campo, e al README la verita' sulla ricerca"
```

---

## Le cinque garanzie, verificate a livello di ramo

Prima della revisione finale, contro il sorgente e non contro i resoconti dei task:

1. **Il tabellone proiettato non può portare il prezzo consigliato.** Quattro punti: il record Java, il tipo TypeScript, il tipo `BidBroadcast`, la regola oxlint — che ora protegge anche `AnalysisPanel`. Ognuno visto fallire almeno una volta.
2. **Nessun aggiornamento ottimistico** anticipa l'`fsync`: nessun `onMutate` in `hooks.ts`, e il test che ispeziona la cache mentre la mutazione è in volo è ancora verde.
3. **Un solo canale `role="status"`** di narrazione ambientale: `grep -rn 'role="status"' frontend/src` deve trovare solo `AuctionAnnouncer`.
4. **Nessuno stato di dominio nel browser**: `bidChannel.ts` porta solo lotto, prezzo e tempo rimanente.
5. **I registri scritti prima di questo ramo si rileggono ancora**: nessun formato di evento è stato toccato, e `mvn test` lo copre.

E la sesta, che vale per questo piano in particolare: **`adapter/in/web` non è stato toccato**, e i suoi 87 test sono passati a ogni task senza che una riga venisse modificata per farli passare.

```bash
git diff --stat main -- src/main/java/com/fantaagent/adapter/in/web
```

Expected: nessuna riga.
