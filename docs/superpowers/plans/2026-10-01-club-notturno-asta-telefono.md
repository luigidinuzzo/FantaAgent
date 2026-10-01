# Club Notturno, l'asta sul telefono — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sotto `lg` l'asta smette di essere la griglia del computer messa in colonna (oggi alta più di 3000px): diventa quattro viste — Banco, Giocatori, Squadre, Rose — con una barra in basso per passare dall'una all'altra, una riga in alto con fase e crediti, la ricerca sempre in vista, e per il banditore un menu «Comandi» al posto della barra dei comandi.

**Architecture:** Un solo albero di componenti per computer e telefono. Da `lg` la griglia di oggi resta identica; sotto `lg` ogni sezione della griglia appartiene a una vista, e quelle delle viste non scelte prendono `max-lg:hidden`. La vista scelta è stato locale di `AuctionRoute` (`phoneView`), riparte da Banco a ogni apertura. Due componenti nuovi: `PhoneViewBar` (la barra in basso, un `tablist`) e `CommandsMenu` (il menu del banditore). Nessun dato nuovo.

**Tech Stack:** React 19, TypeScript, Tailwind v4, vitest + Testing Library, Playwright (`npm run screens`).

**Spec:** `docs/superpowers/specs/2026-09-30-club-notturno-fondamenta-asta-design.md` §5 (e §2, §3). Le decisioni prese durante i due piani precedenti sono in `docs/superpowers/decisions/2026-09-30-club-notturno-fondamenta.md`.

## Global Constraints

- Da `lg` in su l'asta non cambia: ogni classe nuova di impaginazione porta `max-lg:` o vive in un componente che da `lg` non si rende (`lg:hidden`). Le schermate da computer di `npm run screens` devono restare identiche a quelle di `main` (`e8ec4fb`).
- Nessuna modifica al backend, nessuna chiamata nuova.
- L'ordine del documento è l'ordine che si vede, a ogni misura: niente `order-*`, niente posizionamenti che spostano un elemento visivamente prima o dopo i suoi vicini nel DOM.
- Bersagli da almeno 44×44px; la barra delle viste ha bersagli da 64px di altezza.
- Sotto `lg`, nella vista Banco, il banco intero (testata, numeri, bottoni del banditore, rilanci) sta sopra la barra delle viste nella prima schermata a 390×844, in ogni stato: riposo, lotto, conto, tempo scaduto. Ciò che sta sotto il banco nella stessa vista (i consigli) può scorrere.
- L'oro nei quattro posti di sempre (azione principale, numero su cui si decide, dove sei — qui la vista attiva —, ciò che è tuo) più il distintivo «Solo tu».
- Raggi `rounded-lg`; `rounded-full` solo con una voce in `PILLS` di `src/styles/shapes.test.ts`. Mai `text-xs`. Classi dei bottoni da `domain/controls.ts`.
- Testi per utenti finali, in italiano; lessico banco, banditore.
- Un solo `role="alert"` per schermata; `AuctionAnnouncer` resta l'unica live region. La regola oxlint che tiene i consigli fuori dalla proiezione non si allarga né si aggira.
- Le prove che affermano la vecchia impaginazione sotto `lg` si riscrivono, elencate nel rapporto; quelle che falliscono per un comportamento non si toccano.
- Ramo: `ridisegno-telefono`, staccato da `main`. Comandi `npm` da `frontend/`. Commit in italiano con la riga `Co-Authored-By:` del modello che scrive, in fondo dopo una riga vuota.

## File toccati

| File | Cosa diventa |
|---|---|
| `frontend/src/AppShell.tsx` | La barra dei comandi può essere solo da `lg` |
| `frontend/src/domain/ConnectionStatus.tsx` | Variante compatta: sul telefono, «In diretta» è il solo pallino |
| `frontend/src/domain/CommandsMenu.tsx` (nuovo) | Il menu «Comandi» del banditore sul telefono |
| `frontend/src/domain/PhoneViewBar.tsx` (nuovo) | La barra delle quattro viste |
| `frontend/src/domain/ParticipantsColumn.tsx` | Righe a ogni misura |
| `frontend/src/domain/PlayerTable.tsx` | Righe da 56px sul telefono, squadra e titolarità sotto il nome |
| `frontend/src/domain/RosterGrid.tsx` | Sul telefono una squadra alla volta |
| `frontend/src/routes/AuctionRoute.tsx` | Le viste |
| `frontend/scripts/screens.mjs` | Le viste del telefono fotografate e misurate |

---

### Task 1: La testata del telefono su una riga, e la barra dei comandi solo da `lg`

**Files:**
- Modify: `frontend/src/AppShell.tsx`, `frontend/src/AppShell.test.tsx`
- Modify: `frontend/src/domain/ConnectionStatus.tsx`, `frontend/src/domain/ConnectionStatus.test.tsx`

**Interfaces:**
- Produces: `AppShell({ …, actionsFromLg?: boolean })` — con `actionsFromLg` la barra dei comandi prende `max-lg:hidden`. `ConnectionStatus({ …, compact?: boolean })` — con `compact`, quando la connessione è viva, la scritta «In diretta» è `max-sm:sr-only` (resta il pallino); quando è persa la frase resta intera a ogni misura.

- [ ] **Step 1: Il ramo**

```bash
git switch -c ridisegno-telefono
```

(se il piano è già stato committato su questo ramo, il ramo esiste: verificare con `git branch --show-current`.)

- [ ] **Step 2: Le prove**

In `AppShell.test.tsx`:

```tsx
  // Sul telefono la barra dei comandi non c'e': i comandi del banditore stanno in
  // un menu della testata. Da lg resta com'e'.
  it('con actionsFromLg la barra dei comandi esiste solo da schermo largo', () => {
    render(withRouter(
      <AppShell chrome="top" actionsFromLg slotActions={<button type="button">azione</button>}><p>x</p></AppShell>,
    ));
    expect(screen.getByRole('group', { name: 'Comandi della pagina' }).className).toContain('max-lg:hidden');
  });

  it('senza actionsFromLg la barra dei comandi resta a ogni misura', () => {
    render(withRouter(
      <AppShell chrome="top" slotActions={<button type="button">azione</button>}><p>x</p></AppShell>,
    ));
    expect(screen.getByRole('group', { name: 'Comandi della pagina' }).className).not.toContain('max-lg:hidden');
  });
```

In `ConnectionStatus.test.tsx` (con l'impianto che il file già usa per rendere uno stato vivo e uno perso):

```tsx
  // Sul telefono la testata ha posto per il pallino, non per la parola: chi
  // ascolta la sente lo stesso.
  it('compatto e in diretta: la parola c e per chi ascolta, il pallino per chi guarda', () => {
    render(<ConnectionStatus compact updatedAt={NOW} isError={false} now={NOW} />);
    expect(screen.getByText('In diretta').className).toContain('max-sm:sr-only');
  });

  it('compatto ma con la connessione persa: la frase resta intera', () => {
    render(<ConnectionStatus compact updatedAt={NOW - 60_000} isError={false} now={NOW} />);
    expect(screen.getByText(/Connessione persa/).className).not.toContain('sr-only');
  });
```

(`NOW` o il valore che il file usa per l'istante di prova.)

Run: `npm test -- src/AppShell.test.tsx src/domain/ConnectionStatus.test.tsx`
Expected: FAIL sulle prove nuove.

- [ ] **Step 3: Il codice**

`AppShell.tsx`: prop `actionsFromLg = false`, documentata («la barra dei comandi solo da lg: sul telefono la pagina li mette altrove»); il `<div role="group" aria-label="Comandi della pagina" …>` aggiunge `max-lg:hidden` quando è vera.

`ConnectionStatus.tsx`: prop `compact = false`. Il testo, oggi figlio diretto del `<p>`, va in uno `<span>`: con `compact && !stale` lo span prende `max-sm:sr-only`. Il pallino resta.

- [ ] **Step 4: Vedere le prove passare, e commit**

Run: `npm test && npm run build && npm run lint`
Expected: PASS.

```bash
git add frontend/src/AppShell.tsx frontend/src/AppShell.test.tsx frontend/src/domain/ConnectionStatus.tsx frontend/src/domain/ConnectionStatus.test.tsx
git commit -m "Sul telefono la barra dei comandi può mancare, e «In diretta» è un pallino"
```

---

### Task 2: Il menu «Comandi»

**Files:**
- Create: `frontend/src/domain/CommandsMenu.tsx`, `frontend/src/domain/CommandsMenu.test.tsx`

**Interfaces:**
- Produces:

```ts
export function CommandsMenu(props: {
  phases: Role[];
  current: Role;
  onChangePhase: (role: Role) => void;
  phasePending: boolean;
  canUndo: boolean;
  onUndo: () => void;
  undoPending: boolean;
  projectionHref: string;
  settingsHref: string;
}): JSX.Element
```

Un bottone da 44px («Comandi», con l'icona dei tre puntini e il nome visibile da `sm`), che apre un menu: le fasi come `menuitemradio` (`aria-checked` sulla corrente, la corrente disabilitata), poi «Annulla ultimo acquisto» (`menuitem`, disabilitato senza acquisti da annullare o in attesa), «Apri la proiezione» (collegamento, nuova finestra), «Impostazioni dell'asta» (collegamento). Comportamento da menu come `ProfileMenu`: il fuoco va alla prima voce abilitata all'apertura, frecce su e giù, Home, End, Esc chiude e torna al bottone, Tab chiude, un clic fuori chiude. Scegliere una voce esegue e chiude.

- [ ] **Step 1: Le prove**

Creare `CommandsMenu.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { CommandsMenu } from './CommandsMenu';

function renderMenu(overrides: Partial<Parameters<typeof CommandsMenu>[0]> = {}) {
  const props = {
    phases: ['P', 'D', 'C', 'A'] as const,
    current: 'C' as const,
    onChangePhase: vi.fn(),
    phasePending: false,
    canUndo: true,
    onUndo: vi.fn(),
    undoPending: false,
    projectionHref: '/leghe/l1/aste/a1/proiezione',
    settingsHref: '/leghe/l1/aste/a1/impostazioni',
    ...overrides,
  };
  render(<MemoryRouter><CommandsMenu {...props} phases={[...props.phases]} /></MemoryRouter>);
  return props;
}

describe('CommandsMenu', () => {
  it('apre un menu con le fasi, l annullamento, la proiezione e le impostazioni', async () => {
    renderMenu();
    const button = screen.getByRole('button', { name: /Comandi/ });
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    await userEvent.click(button);
    const menu = screen.getByRole('menu', { name: /Comandi/ });
    expect(within(menu).getByRole('menuitemradio', { name: 'Centrocampisti' })).toHaveAttribute('aria-checked', 'true');
    expect(within(menu).getByRole('menuitemradio', { name: 'Portieri' })).toHaveAttribute('aria-checked', 'false');
    expect(within(menu).getByRole('menuitem', { name: 'Annulla ultimo acquisto' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /Apri la proiezione/ })).toHaveAttribute('href', '/leghe/l1/aste/a1/proiezione');
    expect(within(menu).getByRole('menuitem', { name: 'Impostazioni dell\'asta' })).toHaveAttribute('href', '/leghe/l1/aste/a1/impostazioni');
  });

  it('scegliere una fase la cambia e chiude il menu', async () => {
    const props = renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /Comandi/ }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Attaccanti' }));
    expect(props.onChangePhase).toHaveBeenCalledWith('A');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('senza acquisti da annullare la voce e spenta', async () => {
    renderMenu({ canUndo: false });
    await userEvent.click(screen.getByRole('button', { name: /Comandi/ }));
    expect(screen.getByRole('menuitem', { name: 'Annulla ultimo acquisto' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('Esc chiude e riporta il fuoco al bottone', async () => {
    renderMenu();
    const button = screen.getByRole('button', { name: /Comandi/ });
    await userEvent.click(button);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(button).toHaveFocus();
  });

  it('le frecce spostano il fuoco fra le voci', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: /Comandi/ }));
    const first = document.activeElement;
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).not.toBe(first);
    expect(screen.getByRole('menu')).toContainElement(document.activeElement as HTMLElement);
  });
});
```

Run: `npm test -- src/domain/CommandsMenu.test.tsx`
Expected: FAIL (modulo inesistente).

- [ ] **Step 2: Il componente**

Scrivere `CommandsMenu.tsx` seguendo la struttura di `ProfileMenu.tsx` (stato `open`, `buttonRef`, `menuRef`, `itemRefs`, `useId`, la gestione del clic fuori, `onMenuKeyDown` con le stesse quattro chiavi più Esc e Tab, `close(returnFocus)`), con:
- il bottone: `aria-haspopup="menu"`, `aria-expanded`, `aria-controls` quando aperto, classi `BUTTON_SECONDARY` di `controls.ts` più `min-w-11`; dentro un'icona a tre puntini (`aria-hidden`) e `<span className="max-sm:sr-only">Comandi</span>`;
- il menu: `role="menu"`, `aria-label="Comandi dell'asta"`, pannello `panel` posizionato sotto il bottone a destra (`absolute right-0 top-full mt-2 z-40 w-64 p-1`);
- un gruppo `role="group" aria-label="Fase"` con un `menuitemradio` per fase (`ROLE_NAME_PLURAL_CAPITALIZED`), `aria-checked`, la corrente con `aria-disabled="true"`; durante `phasePending` tutte `aria-disabled`;
- un separatore `role="separator"`;
- «Annulla ultimo acquisto»: `menuitem` con `aria-disabled` quando `!canUndo || undoPending`; un clic su una voce disabilitata non fa niente;
- «Apri la proiezione»: `<a role="menuitem" href target="_blank" rel="noopener noreferrer">` col nome accessibile «Apri la proiezione sul secondo schermo» (stessa tecnica dello span con lo spazio fra i due pezzi usata in `AuctionRoute`);
- «Impostazioni dell'asta»: `<Link role="menuitem" to>`.

Il fuoco iniziale va alla prima voce non disabilitata. Ogni voce è alta almeno 44px (la costante `ITEM` di `ProfileMenu` va bene: copiarla, non importarla).

Commento in testa: perché il menu esiste (sul telefono la barra dei comandi non c'è: la fase, l'annullamento, la proiezione e le impostazioni stanno qui; solo per il banditore).

- [ ] **Step 3: Vedere le prove passare, e commit**

Run: `npm test -- src/domain/CommandsMenu.test.tsx` → PASS; poi `npm test && npm run build && npm run lint` → PASS.

```bash
git add frontend/src/domain/CommandsMenu.tsx frontend/src/domain/CommandsMenu.test.tsx
git commit -m "Il menu «Comandi» del banditore per il telefono"
```

---

### Task 3: La barra delle viste

**Files:**
- Create: `frontend/src/domain/PhoneViewBar.tsx`, `frontend/src/domain/PhoneViewBar.test.tsx`

**Interfaces:**
- Produces:

```ts
export type PhoneView = 'banco' | 'giocatori' | 'squadre' | 'rose';
export const PHONE_VIEWS: Array<{ key: PhoneView; label: string }>; // Banco, Giocatori, Squadre, Rose
export function PhoneViewBar(props: {
  view: PhoneView;
  onChange: (view: PhoneView) => void;
  /** L'id dell'elemento che ogni vista mostra, per aria-controls. */
  controls: Record<PhoneView, string>;
}): JSX.Element
```

- [ ] **Step 1: Le prove**

Creare `PhoneViewBar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PhoneViewBar } from './PhoneViewBar';

const CONTROLS = { banco: 'v-banco', giocatori: 'v-giocatori', squadre: 'v-squadre', rose: 'v-rose' };

describe('PhoneViewBar', () => {
  it('quattro schede, la scelta selezionata e in oro', () => {
    render(<PhoneViewBar view="giocatori" onChange={() => {}} controls={CONTROLS} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Banco', 'Giocatori', 'Squadre', 'Rose']);
    const current = screen.getByRole('tab', { name: 'Giocatori' });
    expect(current).toHaveAttribute('aria-selected', 'true');
    expect(current).toHaveAttribute('aria-controls', 'v-giocatori');
    expect(current.className).toContain('text-accent');
    expect(current).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Banco' })).toHaveAttribute('tabindex', '-1');
  });

  it('solo sul telefono', () => {
    render(<PhoneViewBar view="banco" onChange={() => {}} controls={CONTROLS} />);
    expect(screen.getByRole('tablist', { name: "Viste dell'asta" }).parentElement?.className).toContain('lg:hidden');
  });

  it('le frecce scelgono la vista vicina e ci portano il fuoco', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<PhoneViewBar view="banco" onChange={onChange} controls={CONTROLS} />);
    screen.getByRole('tab', { name: 'Banco' }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('rose');
    rerender(<PhoneViewBar view="rose" onChange={onChange} controls={CONTROLS} />);
    expect(screen.getByRole('tab', { name: 'Rose' })).toHaveFocus();
  });

  it('i bersagli sono alti 64px', () => {
    render(<PhoneViewBar view="banco" onChange={() => {}} controls={CONTROLS} />);
    screen.getAllByRole('tab').forEach((t) => expect(t.className).toContain('min-h-16'));
  });
});
```

Run: `npm test -- src/domain/PhoneViewBar.test.tsx` → FAIL.

- [ ] **Step 2: Il componente**

`PhoneViewBar.tsx`: un contenitore `lg:hidden sticky bottom-0 z-30 border-t border-panel-border bg-bar` con dentro `<div role="tablist" aria-label="Viste dell'asta" className="grid grid-cols-4">`; ogni scheda è un `<button role="tab">` con `aria-selected`, `aria-controls={controls[key]}`, `tabIndex` 0 sulla scelta e -1 sulle altre, `min-h-16 text-sm font-semibold`, la scelta `text-accent shadow-[inset_0_2px_0_var(--color-accent)]`, le altre `text-muted-foreground`; `FOCUS_RING`. Frecce sinistra/destra (con giro), Home, End chiamano `onChange` con la vicina e, dopo l'aggiornamento, spostano il fuoco sulla scheda nuova (un `useEffect` sul `view` che mette il fuoco sulla scheda scelta solo se il fuoco era già dentro la barra). Commento in testa: perché una barra in basso (sul telefono la griglia del computer messa in colonna era alta più di tremila pixel; quattro viste, ognuna in una schermata).

- [ ] **Step 3: Vedere le prove passare, e commit**

Run: `npm test -- src/domain/PhoneViewBar.test.tsx` → PASS; `npm test && npm run build && npm run lint` → PASS.

```bash
git add frontend/src/domain/PhoneViewBar.tsx frontend/src/domain/PhoneViewBar.test.tsx
git commit -m "La barra delle quattro viste dell'asta sul telefono"
```

---

### Task 4: Squadre, giocatori e rose nella forma del telefono

**Files:**
- Modify: `frontend/src/domain/ParticipantsColumn.tsx`, `ParticipantsColumn.test.tsx`
- Modify: `frontend/src/domain/PlayerTable.tsx`, `PlayerTable.test.tsx`
- Modify: `frontend/src/domain/RosterGrid.tsx`, `RosterGrid.test.tsx`

**Interfaces:**
- Produces: `ParticipantsColumn` e `PlayerTable` con props invariate; `RosterGrid({ fill })` invariato nella firma.

- [ ] **Step 1: Le squadre come righe a ogni misura**

Oggi sotto `lg` le squadre sono una fila di card che scorre di lato (la si teneva in cima alla pagina). Con le viste, sul telefono le squadre hanno una vista tutta loro: le righe di §4.2 a tutta larghezza. In `ParticipantsColumn.tsx` le classi `max-lg:` della fila di card si tolgono e quelle `lg:` delle righe perdono il prefisso, così le righe valgono a ogni misura. Le prove che affermavano la fila sotto `lg` (`max-lg:border-panel-border`, `max-lg:truncate`, `text-muted-foreground` sui crediti sotto `lg`…) si riscrivono per affermare le righe senza prefisso; elencarle.

- [ ] **Step 2: I giocatori, righe da 56px**

In `PlayerTable.tsx`, sotto `sm` (dove le colonne Squadra, Fantamedia e Titolarità sono già nascoste): la riga sotto il nome dice `{squadra} · {titolarità}% titolare`; il bottone della riga prende `max-lg:min-h-14`. Prova:

```tsx
  it('sul telefono sotto il nome ci sono squadra e titolarita', () => {
    render(<PlayerTable rows={ROWS} selectedId={null} onSelect={() => {}} />);
    const first = screen.getAllByRole('button', { name: /^Valuta / })[0];
    expect(first).toHaveTextContent(`${ROWS[0].team} · ${Math.round(ROWS[0].titolaritaPercent)}% titolare`);
    expect(first.className).toContain('max-lg:min-h-14');
  });
```

- [ ] **Step 3: Le rose, una squadra alla volta**

In `RosterGrid.tsx`, con `fill`, sotto `lg`: in cima un selettore `<label>` «Squadra» con un `<select>` (classe `FIELD` di `controls.ts`, `lg:hidden`) che elenca le squadre con la tua per prima (l'ordinamento con `fill` c'è già); predefinita la tua. Le colonne non scelte prendono `max-lg:hidden`. La frase «Scorri di lato per vedere le altre squadre» e la sfumatura a destra prendono `max-lg:hidden` con `fill`. Senza `fill` niente cambia. Prova (con l'impianto del file):

```tsx
  // Sul telefono otto colonne una accanto all'altra non si leggono: una squadra
  // alla volta, scelta da un selettore, la tua per prima.
  it('a riempimento sul telefono una squadra alla volta, scelta dal selettore', async () => {
    // …stessa preparazione delle altre prove del file, rendendo <RosterGrid fill />…
    const select = await screen.findByLabelText('Squadra');
    const columns = document.querySelectorAll('section[aria-labelledby^="roster-"]');
    const visible = [...columns].filter((c) => !c.className.includes('max-lg:hidden'));
    expect(visible).toHaveLength(1);
    expect(visible[0].getAttribute('aria-labelledby')).toBe(`roster-${(select as HTMLSelectElement).value}`);
    await userEvent.selectOptions(select, /* l'id di un'altra squadra del tabellone di prova */);
    // …la colonna visibile ora e' quella scelta…
  });
```

Completare i commenti `…` con l'impianto reale del file (come carica il tabellone, quali id hanno le squadre).

- [ ] **Step 4: Vedere le prove passare, e commit**

Run: `npm test && npm run build && npm run lint` → PASS.

```bash
git add -A frontend/src/domain
git commit -m "Sul telefono: le squadre in righe, i giocatori con squadra e titolarità, una rosa alla volta"
```

---

### Task 5: Le viste dentro l'asta

**Files:**
- Modify: `frontend/src/routes/AuctionRoute.tsx`, `frontend/src/routes/AuctionRoute.test.tsx`

**Interfaces:**
- Consumes: `AppShell actionsFromLg`, `ConnectionStatus compact` (Task 1), `CommandsMenu` (Task 2), `PhoneViewBar`, `PhoneView`, `PHONE_VIEWS` (Task 3).

- [ ] **Step 1: Le prove**

In `AuctionRoute.test.tsx` (con `stubApi`, `STATE`, `renderAuction` del file):

```tsx
  describe('sul telefono', () => {
    it('si apre sulla vista Banco, con le altre sezioni nascoste sotto lg', async () => {
      stubApi({ state: STATE });
      renderAuction();
      const bar = await screen.findByRole('tablist', { name: "Viste dell'asta" });
      expect(within(bar).getByRole('tab', { name: 'Banco' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('banco').className).not.toContain('max-lg:hidden');
      expect(screen.getByRole('region', { name: 'Crediti delle squadre' }).className).toContain('max-lg:hidden');
    });

    it('la vista Giocatori mostra la tabella della fase, e sceglierne uno riporta al Banco', async () => {
      stubApi({ state: STATE });
      renderAuction();
      await userEvent.click(await screen.findByRole('tab', { name: 'Giocatori' }));
      expect(screen.getByTestId('banco').className).toContain('max-lg:hidden');
      await userEvent.click(await screen.findByRole('button', { name: 'Valuta Giocatore Uno' }));
      expect(screen.getByRole('tab', { name: 'Banco' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('banco').className).not.toContain('max-lg:hidden');
    });

    it('la vista Rose mostra le rose, la vista Squadre le squadre', async () => {
      stubApi({ state: STATE });
      renderAuction();
      await userEvent.click(await screen.findByRole('tab', { name: 'Squadre' }));
      expect(screen.getByRole('region', { name: 'Crediti delle squadre' }).className).not.toContain('max-lg:hidden');
      await userEvent.click(screen.getByRole('tab', { name: 'Rose' }));
      expect(screen.getByRole('tab', { name: 'Rose squadre' })).toHaveAttribute('aria-selected', 'true');
    });

    it('in alto la fase e i tuoi crediti, sempre in vista', async () => {
      stubApi({ state: STATE });
      renderAuction();
      const strip = await screen.findByTestId('phone-strip');
      expect(strip).toHaveTextContent('Portieri');
      expect(strip).toHaveTextContent('300 crediti · 25 posti');
      expect(strip.className).toContain('lg:hidden');
    });

    it('il banditore ha il menu «Comandi»; chi non lo e no', async () => {
      stubApi({ state: STATE });
      renderAuction();
      expect(await screen.findByRole('button', { name: /Comandi/ })).toBeInTheDocument();
    });
  });
```

e, nel blocco delle prove di chi non è amministratore (il file ne ha già: usare lo stato che quelle usano), una prova che il bottone «Comandi» non c'è.

Run: `npm test -- src/routes/AuctionRoute.test.tsx` → FAIL sulle prove nuove.

- [ ] **Step 2: Le viste**

In `AuctionRoute.tsx`:

1. Stato: `const [phoneView, setPhoneView] = useState<PhoneView>('banco');` e un aiuto `const shownOnPhone = (...views: PhoneView[]) => (views.includes(phoneView) ? '' : 'max-lg:hidden');`.
2. Una funzione `selectPlayer(id: string) { setSelectedId(id); setPhoneView('banco'); }` che sostituisce `setSelectedId` dove la selezione nasce da un gesto: `PlayerSearchBox onSelect`, `PlayerTable onSelect`, `AdviceColumn onSelect`. (Da `lg` cambiare `phoneView` non ha effetti.)
3. Cambiare vista da `PhoneViewBar`: `Giocatori` porta anche `setActiveTab('fase')`, `Rose` porta `setActiveTab('rose')`.
4. Le sezioni della riga dell'asta, nel ramo di chi ha un posto, aggiungono alla loro `className`:
   - `ParticipantsColumn`: `shownOnPhone('squadre')`, e un `id` (per `aria-controls`);
   - il contenitore della ricerca: niente (sempre in vista);
   - il banco (`data-testid="banco"`): `shownOnPhone('banco')`, e un `id`;
   - `AdviceColumn`: `shownOnPhone('banco')`;
   - il pannello delle schede: `shownOnPhone('giocatori', 'rose')`; il suo `tablist` interno prende `max-lg:hidden` (sul telefono la scheda la sceglie la barra in basso); `tabpanel-fase` e `tabpanel-rose` hanno già un `id`.
5. Sopra la riga dell'asta, nel ramo di chi ha un posto, la riga della fase:

```tsx
        {me && state.data ? (
          // Sul telefono, sempre in vista: cosa si sta chiamando e quanto ti resta.
          // Da lg lo dicono la barra dei comandi e la colonna delle squadre.
          <div data-testid="phone-strip" className="mb-3 flex items-center justify-between gap-3 text-sm lg:hidden">
            <span className="flex items-center gap-2 font-semibold">
              <RoleBadge role={state.data.currentPhase} />
              {ROLE_NAME_PLURAL_CAPITALIZED[state.data.currentPhase]}
            </span>
            <span className="tnum text-muted-foreground">
              <span className="font-semibold text-accent">{me.budgetRemaining}</span>
              {` crediti · ${me.slotsRemaining} posti`}
            </span>
          </div>
        ) : null}
```

6. Dopo la riga dell'asta, nello stesso ramo: `<PhoneViewBar view={phoneView} onChange={…} controls={{ banco: <id del banco>, giocatori: 'tabpanel-fase', squadre: <id delle squadre>, rose: 'tabpanel-rose' }} />`. Con la ricerca attiva il banco non c'è: `controls.banco` punta allora al contenitore della ricerca (dargli un `id`).
7. La barra dei comandi solo da `lg`: `<AppShell … actionsFromLg>` sulla pagina dell'asta. Nel `slotStatus`: `<ConnectionStatus compact … />` e, per l'amministratore, `<span className="lg:hidden"><CommandsMenu phases={…} current={…} onChangePhase={changePhaseTo} phasePending={changePhase.isPending} canUndo={state.data?.canUndo ?? false} onUndo={undo} undoPending={undoLast.isPending} projectionHref={…} settingsHref={…} /></span>` — gli stessi gestori della barra dei comandi, non copie.
8. L'avviso dell'acquisto in basso (`fixed inset-x-0 bottom-6`) sale sopra la barra delle viste: `max-lg:bottom-20`.
9. Il ramo dell'asta conclusa e quello di chi non ha un posto restano come sono: niente viste, niente barra.

I commenti che descrivono l'impaginazione sotto `lg` («Sotto lg la griglia si srotola in una colonna sola…») si riscrivono: sotto lg le viste.

- [ ] **Step 3: Vedere le prove passare, e commit**

Run: `npm test -- src/routes/AuctionRoute.test.tsx` → PASS; `npm test && npm run build && npm run lint` → PASS. Le prove che affermavano l'impaginazione del telefono in colonna si riscrivono (elencarle).

```bash
git add -A frontend/src
git commit -m "L'asta sul telefono in quattro viste, con la barra in basso e il menu «Comandi»"
```

---

### Task 6: Fotografare le viste, misurare il banco, scrivere

**Files:**
- Modify: `frontend/scripts/screens.mjs`
- Modify: i componenti che lo Step 3 dovesse accorciare
- Modify: `docs/superpowers/decisions/2026-09-30-club-notturno-fondamenta.md` (una sezione in fondo)

- [ ] **Step 1: Le viste nello script**

In `screens.mjs`, per le misure con larghezza < 1024: dopo `13-asta-riposo-<tag>`, tre fotografie in più toccando la barra delle viste (`page.getByRole('tab', { name: 'Giocatori' })`, poi `Squadre`, poi `Rose`): `13g-asta-giocatori-<tag>`, `13s-asta-squadre-<tag>`, `13r-asta-rose-<tag>`; poi si torna su Banco prima di `14-asta-giocatore` (che sceglie il giocatore dalla vista Giocatori: toccare «Giocatori», poi il nome, e verificare di essere tornati su Banco). Per le schermate 13, 14, 14b, 14d sotto 1024px misurare se il fondo del banco (`[data-testid=banco]`) sta sopra il bordo superiore della barra delle viste nella prima schermata (`getBoundingClientRect().bottom <= barTop` a pagina in cima) e stampare l'elenco `banco sotto la piega:`. La fotografia del telefono resta a pagina intera; per guardare la prima schermata, ritagliare i primi 844px.

- [ ] **Step 2: Misurare**

```bash
SIZES=1440x900,390x844,360x780 npm run screens -- test-results/screens/telefono
```

Le schermate desktop devono essere identiche a quelle di `main`: il confronto si fa con `test-results/screens/asta-finale/*-desktop.png`, fotografate da `main` (`e8ec4fb`) a 1440×900 alla fine del piano precedente. `banco sotto la piega:` deve essere vuoto a 390×844.

- [ ] **Step 3: Far stare il banco sopra la piega**

Se a 390×844 il banco esce dalla prima schermata in uno stato, accorciarlo sotto `lg` soltanto (classi `max-lg:`), in quest'ordine, rimisurando dopo ogni passo:
1. nel conto alla rovescia, le tre caselle su una riga anche sotto `sm` (oggi `max-sm:grid-cols-2`) con i numeri più piccoli (`max-sm:text-4xl` per i secondi, `max-sm:text-5xl` per l'offerta);
2. la riga privata del conto su due righe al massimo (il «se lo prendi» va a capo sotto il tetto, non accanto);
3. nella scheda del lotto i tre numeri in una griglia `grid-cols-3` sotto il tetto invece che in fila;
4. a tempo scaduto i bottoni squadra senza la seconda riga (crediti) sotto `sm`.
Ogni passo con la sua prova; nessun passo tocca `lg` e oltre. A 360×780 si annota l'esito senza obbligo.

- [ ] **Step 4: Guardare**

Aprire a 390×844: 13 (Banco a riposo), 13g, 13s, 13r, 14, 14b, 14d. Per ognuna: la barra in basso c'è e la vista giusta è in oro? La testata sta su una riga? La riga della fase e dei crediti c'è? Niente scorre di lato? A 1440×900 le schermate sono quelle di prima?

- [ ] **Step 5: Scrivere, e commit**

In fondo a `docs/superpowers/decisions/2026-09-30-club-notturno-fondamenta.md`: `## L'asta sul telefono — misure finali`, con per 390×844 e 360×780 e per ogni stato del banco se sta sopra la piega e di quanto; i passi dello Step 3 applicati; cosa resta.

```bash
npm test && npm run build && npm run lint
git add -A frontend docs/superpowers/decisions/2026-09-30-club-notturno-fondamenta.md
git commit -m "L'asta sul telefono misurata: il banco nella prima schermata"
```
