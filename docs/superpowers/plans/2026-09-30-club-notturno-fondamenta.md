# Club Notturno, fondamenta — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tutto il frontend passa alla direzione «Club Notturno»: palette nuova, fondo uniforme senza erba fuori dall'ingresso, raggi da 8px, testo mai sotto 13px, barra di navigazione con il percorso e barra dei comandi separata. L'impaginazione delle pagine non cambia.

**Architecture:** La palette resta generata da `frontend/scripts/palette.mjs`; i componenti leggono già i token, quindi il cambio di colore è in un punto solo. Le regole di forma e di misura si difendono con prove che leggono il sorgente, come già fanno `contrast.test.ts` e `weights.test.ts`. `AppShell` si divide in due barre e prende una prop `trail`. Uno script Playwright con risposte finte (`frontend/scripts/screens.mjs`) fotografa ogni pagina senza backend, prima e dopo.

**Tech Stack:** React 19, TypeScript, Vite 8, Tailwind v4 (`@theme`, `@utility`), TanStack Query, React Router 7, vitest + Testing Library, Playwright (`@playwright/test`), oxlint.

**Spec:** `docs/superpowers/specs/2026-09-30-club-notturno-fondamenta-asta-design.md` — questo piano copre §3 (fondamenta) e §6 (le altre pagine, proiezione compresa). §4 (asta sul computer) e §5 (asta sul telefono) hanno ciascuno un piano proprio, da scrivere dopo che questo è eseguito: la misura del banco va presa su uno screenshot vero con le fondamenta in posto.

## Global Constraints

- Nessuna modifica al backend, ai DTO, agli indirizzi delle rotte. Nessuna dipendenza nuova.
- `/legacy` non si tocca: `src/main/resources/templates/**` e `static/app.css` restano come sono.
- L'impaginazione delle pagine resta quella di oggi. Si cambiano colori, raggi, misura del testo, barre. Se la pelle nuova rende una pagina peggiore, lo si annota (Task 8), non lo si rattoppa.
- I colori si cambiano **solo** in `frontend/scripts/palette.mjs`; `src/styles/tokens.css` si rigenera con `npm run tokens`, mai a mano.
- Valori esatti della palette: `background #07130E`, `bar #0A1A12`, `surface #0D2117`, `surface-raised #143020`, `panel-border #274636`, `control-border #5F8F75`, `foreground #F3F6F2`, `muted-foreground #A7B8AD`, `accent #F5B942`, `on-accent #1B1400`, `positive #4ED187`, `destructive #F06A6A`, `role-p #FFB84D`, `role-d #55D98A`, `role-c #63B3FF`, `role-a #FF6F91`, `grass #2E6B34`, `grass-stripe #29612F`; `line` bianco 9%, `line-strong` bianco 18%, `chalk` bianco 40%.
- Raggio di pannelli, bottoni e campi: `rounded-lg` (8px). `rounded-full` solo per stati ed etichette.
- Testo che porta informazione: mai `text-xs`. Misure nuove: `text-meta` (13px), `text-body` (15px).
- Bersagli da almeno 44×44px. Il contorno di messa a fuoco resta `FOCUS_RING` di `domain/controls.ts`.
- Testi visibili per utenti finali, in italiano, senza riferimenti a file, server o codice. Lessico: «banco», «banditore».
- Un solo `role="alert"` alla volta per schermata: non se ne aggiungono.
- La regola oxlint che vieta alla proiezione i componenti dei consigli (`.oxlintrc.json`) non si allarga.
- Tutti i comandi `npm` si lanciano da `frontend/`.
- Ogni commit termina con la riga `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Ramo di lavoro: `ridisegno-club-notturno`.

## File toccati

| File | Cosa diventa |
|---|---|
| `frontend/scripts/screens.mjs` (nuovo) | Fotografa ogni pagina con risposte finte |
| `frontend/scripts/palette.mjs` | I valori di Club Notturno, con `bar`, `control-border`, `grass` |
| `frontend/src/styles/contrast.test.ts` | Le coppie nuove |
| `frontend/src/styles/shapes.test.ts` (nuovo) | Raggi e pillole |
| `frontend/src/styles/sizes.test.ts` (nuovo) | Nessun `text-xs` |
| `frontend/src/index.css` | `panel` col raggio, misure di testo, erba su `--grass`, `--header-h` |
| `frontend/src/AppFrame.tsx` | Solo il fondo |
| `frontend/src/AppShell.tsx` | Due barre e il percorso |
| `frontend/src/domain/PageFrame.tsx` (da `PitchFrame.tsx`) | Il contenitore di pagina, senza gesso |
| `frontend/src/domain/Crest.tsx` (da `PitchFrame.tsx`) | Lo stemma della lega |
| `frontend/src/domain/HalfPitch.tsx`, `PitchGrass.tsx` | L'erba solo nella metà campo d'ingresso |
| `frontend/src/domain/controls.ts` | `BUTTON_PRIMARY`, `BUTTON_SECONDARY`, `BUTTON_DESTRUCTIVE`, `FIELD` |
| `frontend/src/api/leagues.ts` | `useLeagueName` |
| `frontend/src/domain/BackLink.tsx` | Eliminato |
| Tutte le rotte sotto `frontend/src/routes/` | `trail`, `PageFrame`, classi meccaniche |

---

### Task 1: Lo script che fotografa le schermate

Prima di cambiare qualcosa serve il modo di guardare: le prove in jsdom non dicono niente su proporzioni e colori. Lo script risponde al posto del backend con `page.route()`, quindi non crea aste vere.

**Files:**
- Create: `frontend/scripts/screens.mjs`
- Modify: `frontend/package.json` (script `screens`)
- Modify: `frontend/README.md` (una sezione)

**Interfaces:**
- Produces: `npm run screens -- <cartella>` scrive un PNG per pagina in `<cartella>` (predefinita `test-results/screens`) e stampa `ok <nome>` per ognuno, poi `larghe:` con le pagine che scorrono di lato e `non gestite:` con le chiamate a cui non ha saputo rispondere. Richiede `npm run dev` già avviato; l'indirizzo si cambia con `BASE=http://localhost:5175`.

- [ ] **Step 1: Scrivere lo script**

Crea `frontend/scripts/screens.mjs`:

```js
// Fotografa ogni pagina senza backend: Vite gia' avviato, risposte finte.
//
//   npm run dev                       (in un altro terminale)
//   npm run screens -- test-results/screens/prima
//
// Il filtro delle chiamate guarda il percorso, non '**/api/**': quello prenderebbe
// anche i moduli che Vite serve da /src/api/, e la pagina resterebbe bianca.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = resolve(process.argv[2] ?? 'test-results/screens');
mkdirSync(OUT, { recursive: true });

const ROLES = ['P', 'D', 'C', 'A'];
const SLOTS = { P: 3, D: 8, C: 8, A: 6 };
const TEAMS = ['Real Colizzati', 'Atletico Ma Non Troppo', 'Borussia Porcmund', 'Longobarda',
  'AC Picchia', 'Dinamo Spritz', 'Scarsenal', 'Patetico Madrid'];
const PEOPLE = ['Luigi', 'Diego', 'Marta', 'Paolo', 'Sara', 'Andrea', 'Giulia', 'Tommaso'];
const NAMES = {
  P: ['Maignan', 'Sommer', 'Di Gregorio', 'Svilar', 'Carnesecchi', 'Meret', 'Provedel', 'De Gea', 'Skorupski',
    'Milinkovic-Savic', 'Okoye', 'Falcone', 'Suzuki', 'Montipo', 'Caprile', 'Leali', 'Audero', 'Muric', 'Butez',
    'Turati', 'Perin', 'Mandas', 'Martinez', 'Terracciano', 'Scuffet'],
  D: ['Dimarco', 'Bastoni', 'Dumfries', 'Theo Hernandez', 'Di Lorenzo', 'Bremer', 'Gosens', 'Dodo', 'Cambiaso',
    'Buongiorno', 'Tavares', 'Angelino', 'Bellanova', 'Zappacosta', 'Kalulu', 'Pavard', 'Rrahmani', 'Mancini',
    'Ndicka', 'Gatti', 'Acerbi', 'Tomori', 'Romagnoli', 'Gila', 'Kolasinac', 'Hien', 'Zortea', 'Carlos Augusto',
    'Olivera', 'Spinazzola', 'Miranda', 'Holm', 'Lucumi', 'Beukema', 'Posch', 'Baschirotto', 'Gallo', 'Dorgu',
    'Coco', 'Vojvoda', 'Bijol', 'Kristensen', 'Solet', 'Zemura', 'Tchatchoua', 'Valeri', 'Luperto', 'Mina',
    'Augello', 'Zappa', 'Ismajli', 'Pezzella', 'Goldaniga', 'Kempf', 'Pongracic', 'Ranieri', 'Comuzzo', 'Parisi',
    'Biraghi', 'Marusic', 'Lazzari', 'Pellegrini', 'Celik', 'Hermoso'],
  C: ['Pulisic', 'Reijnders', 'Calhanoglu', 'McTominay', 'Barella', 'Koopmeiners', 'Zaccagni', 'Orsolini',
    'Politano', 'Ederson', 'De Roon', 'Mkhitaryan', 'Anguissa', 'Lobotka', 'Locatelli', 'Thuram K.', 'Frattesi',
    'Zielinski', 'Fofana', 'Loftus-Cheek', 'Guendouzi', 'Rovella', 'Dele-Bashiru', 'Pellegrini Lo.', 'Kone',
    'Cristante', 'Pisilli', 'Bove', 'Adli', 'Cataldi', 'Freuler', 'Ferguson', 'Ndoye', 'Odgaard', 'Ricci',
    'Vlasic', 'Linetty', 'Lovric', 'Payero', 'Thauvin', 'Strefezza', 'Nico Paz', 'Perrone', 'Da Cunha',
    'Bernabe', 'Man', 'Sohm', 'Cancellieri', 'Duda', 'Suslov', 'Tengstedt', 'Marin', 'Makoumbou', 'Gaetano',
    'Frendrup', 'Thorsby', 'Badelj', 'Maleh', 'Anjorin', 'Fazzini'],
  A: ['Lautaro Martinez', 'Thuram M.', 'Vlahovic', 'Lukaku', 'Retegui', 'Kean', 'Dovbyk', 'Leao', 'Kvaratskhelia',
    'Lookman', 'Castellanos', 'Dybala', 'Yildiz', 'Morata', 'Abraham', 'Gudmundsson', 'Lucca', 'Pinamonti',
    'Krstovic', 'Dia', 'Zapata', 'Adams', 'Castro', 'Dallinga', 'Cutrone', 'Piccoli', 'Bonny', 'Djuric',
    'Colombo', 'Esposito S.'],
};
const CLUBS = ['Inter', 'Milan', 'Juventus', 'Napoli', 'Atalanta', 'Roma', 'Lazio', 'Fiorentina', 'Bologna',
  'Torino', 'Udinese', 'Genoa', 'Como', 'Parma', 'Verona', 'Cagliari', 'Lecce', 'Empoli', 'Monza', 'Venezia'];

const players = {};
for (const r of ROLES) {
  players[r] = NAMES[r].map((name, i) => {
    const top = { P: 22, D: 24, C: 38, A: 45 }[r];
    const listPrice = Math.max(1, Math.round(top * Math.exp(-i / (NAMES[r].length / 3.2))));
    const expectedPrice = Math.max(1, Math.round(listPrice * (r === 'A' ? 5.2 : r === 'C' ? 3.4 : 2.1)));
    const maxBid = Math.max(1, Math.round(expectedPrice * (0.85 + ((i * 7) % 5) * 0.08)));
    return {
      id: `${r}${i}`, name, team: CLUBS[(i * 3 + r.charCodeAt(0)) % CLUBS.length], role: r, listPrice,
      expectedPrice, maxBid, margin: maxBid - expectedPrice,
      fantamediaAttesa: Math.round((7.9 - i * 0.035 + (r === 'P' ? -2.2 : 0)) * 100) / 100,
      titolaritaPercent: Math.max(35, 98 - ((i * 11) % 47)),
      worthPursuing: maxBid >= expectedPrice,
    };
  });
}
const everyone = Object.values(players).flat();

// Portieri e difensori venduti, centrocampisti in corso.
let seq = 0;
const board = TEAMS.map((name, t) => {
  const byRole = { P: [], D: [], C: [], A: [] };
  let spent = 0;
  const take = (role, count) => {
    for (let k = 0; k < count; k++) {
      const p = players[role][(k * TEAMS.length + t) % players[role].length];
      const price = Math.max(1, Math.round(p.expectedPrice * (0.7 + ((t + k) % 4) * 0.2)));
      spent += price;
      byRole[role].push({ seq: ++seq, playerName: p.name, price });
    }
  };
  take('P', 3);
  take('D', 8);
  take('C', [3, 2, 4, 1, 3, 2, 2, 3][t]);
  return { t, name, byRole, spent: Math.min(spent, 380) };
});
const soldNames = new Set(board.flatMap((b) => ROLES.flatMap((r) => b.byRole[r].map((s) => s.playerName))));
const participants = board.map((b) => {
  const filledByRole = Object.fromEntries(ROLES.map((r) => [r, b.byRole[r].length]));
  const filled = ROLES.reduce((n, r) => n + filledByRole[r], 0);
  return {
    id: `T${b.t}`, name: b.name, initial: b.name[0], me: b.t === 0, budgetRemaining: 500 - b.spent,
    slotsRemaining: 25 - filled, filledByRole, slotsByRole: SLOTS,
  };
});
const freeC = players.C.filter((p) => !soldNames.has(p.name));

const members = TEAMS.map((teamName, i) => ({
  userId: `U${i}`, displayName: PEOPLE[i], teamName, initial: teamName[0],
  role: i === 0 ? 'ADMIN' : 'MEMBER', me: i === 0,
}));
const me = { id: 'U0', email: 'luigi@esempio.it', displayName: 'Luigi', emailVerified: false };
const bidder = { bidTimerSeconds: 5, beepEnabled: true };
const auctions = [
  { id: 'A1', name: 'Asta estiva 2026', createdAt: '2026-09-01T18:00:00Z', lastWritten: '2026-09-28T21:10:00Z',
    purchases: seq, phase: 'C', teams: 8, budget: 500, totalSlots: 200,
    myBudgetRemaining: participants[0].budgetRemaining, bidder },
  { id: 'A2', name: 'Asta di riparazione', createdAt: '2026-01-10T18:00:00Z', lastWritten: '2026-01-12T22:00:00Z',
    purchases: 24, phase: 'A', teams: 8, budget: 150, totalSlots: 24, myBudgetRemaining: 12, bidder },
];
const leagues = [
  { id: 'L1', name: 'Lega dei Colizzati', admin: true, teamName: 'Real Colizzati', initial: 'R', members: 8, auctions: 2, pendingRequests: 2 },
  { id: 'L2', name: 'Fantaufficio', admin: false, teamName: 'Scarsenal', initial: 'S', members: 10, auctions: 1, pendingRequests: 0 },
  { id: 'L3', name: 'Calcetto del giovedì', admin: false, teamName: 'Dinamo Spritz', initial: 'D', members: 6, auctions: 2, pendingRequests: 0 },
];
const rules = {
  bidder, canEdit: true, rules: { budget: 500, slots: SLOTS },
  scoring: {
    defenceModifierEnabled: true, defendersCounted: 4,
    thresholds: [{ minAverage: 6, bonus: 1 }, { minAverage: 6.5, bonus: 3 }, { minAverage: 7, bonus: 6 }],
    goalBonus: { P: 3, D: 3, C: 3, A: 3 }, assist: 1, penaltyScored: 3, penaltyMissed: -3, penaltySaved: 3,
    yellowCard: -0.5, redCard: -1, goalConceded: -1, cleanSheet: 1, confirmed: true,
  },
};
const valuation = (p) => ({
  playerId: p.id, name: p.name, team: p.team, role: p.role, listPrice: p.listPrice, expectedPrice: p.expectedPrice,
  maxBid: p.maxBid, hardCap: p.maxBid + 14, margin: p.margin, walkAwayReason: '', worthPursuing: p.worthPursuing,
  confidenceStars: 4,
  drivers: [
    { label: 'Fantamedia attesa', contribution: 31, explanation: 'Segna e fa assist più della media del ruolo.' },
    { label: 'Titolarità', contribution: 12, explanation: 'Gioca quasi sempre dall\'inizio.' },
    { label: 'Scarsità nel ruolo', contribution: 9, explanation: 'Pochi centrocampisti di questa fascia sono ancora liberi.' },
    { label: 'Rigorista', contribution: 6, explanation: 'Calcia i rigori della sua squadra.' },
    { label: 'Calendario', contribution: -4, explanation: 'Le prossime giornate sono difficili.' },
  ],
});

const unknown = new Set();
function respond(method, path, query, authed) {
  const J = (body, status = 200) => ({ status, body });
  if (path === '/api/me') {
    return authed ? J(me) : J({ type: 'https://fantaagent.local/problems/unauthenticated', detail: 'no' }, 401);
  }
  if (path === '/api/auth/csrf') return J({});
  if (path.startsWith('/api/auth/')) return J(null);
  if (path.startsWith('/api/invites/')) {
    return J({ leagueId: 'L1', leagueName: 'Lega dei Colizzati', invitedBy: 'Diego', alreadyMember: false, takenInitials: [] });
  }
  if (path === '/api/join-requests') {
    return J([{ leagueId: 'L9', leagueName: 'Serie Zeta', teamName: 'Longobarda', requestedAt: '2026-09-27T10:00:00Z' }]);
  }
  if (path === '/api/leagues') return J(leagues);
  if (path === '/api/leagues/search') {
    return J([
      { id: 'L7', name: 'Lega Bar Sport', adminName: 'Paolo', members: 9, status: 'NONE' },
      { id: 'L8', name: 'Lega Barcollo', adminName: 'Marta', members: 12, status: 'PENDING' },
      { id: 'L2', name: 'Fantaufficio Bar', adminName: 'Sara', members: 10, status: 'MEMBER' },
    ]);
  }
  let m = path.match(/^\/api\/leagues\/([^/]+)(\/.*)?$/);
  if (!m) { unknown.add(`${method} ${path}`); return J({ detail: 'x' }, 404); }
  const rest = m[2] ?? '';
  if (rest === '') return J({ id: 'L1', name: 'Lega dei Colizzati', admin: true, members });
  if (rest === '/invites') return J([{ id: 'I1', createdAt: '2026-09-25T10:00:00Z', expiresAt: '2026-10-09T10:00:00Z' }]);
  if (rest === '/join-requests') {
    return J([
      { userId: 'U20', displayName: 'Francesca', teamName: 'Hellas Madonna', requestedAt: '2026-09-28T10:00:00Z' },
      { userId: 'U21', displayName: 'Matteo', teamName: 'Sporting Lesbona', requestedAt: '2026-09-29T10:00:00Z' },
    ]);
  }
  if (rest === '/auctions') return J(auctions);
  if (rest === '/rules') return J(rules);
  m = rest.match(/^\/auctions\/([^/]+)(\/.*)?$/);
  if (!m) { unknown.add(`${method} ${path}`); return J({ detail: 'x' }, 404); }
  const a = m[2] ?? '';
  if (a === '/seats') {
    return J({ locked: true, seats: members.map((x, i) => ({
      userId: x.userId, displayName: x.displayName, teamName: x.teamName, initial: x.initial, position: i })) });
  }
  if (a === '/state') {
    return J({ auctionId: 'A1', auctionName: 'Asta estiva 2026', currentPhase: 'C', phases: ROLES, soldInPhase: 20,
      myParticipantId: 'T0', canUndo: true, participants, version: seq, admin: true });
  }
  if (a === '/board') {
    return J({ auctionId: 'A1', currentPhase: 'C', columns: board.map((b, i) => ({
      participantId: `T${b.t}`, participantName: b.name, me: i === 0, budgetRemaining: participants[i].budgetRemaining,
      slotsRemaining: participants[i].slotsRemaining, byRole: b.byRole })) });
  }
  if (a === '/players/phase') {
    const offset = Number(query.get('offset') ?? 0);
    return J({ rows: freeC.slice(offset, offset + 25), offset, pageSize: 25, total: freeC.length,
      hasPrevious: offset > 0, hasNext: offset + 25 < freeC.length });
  }
  if (a === '/players/targets') return J(freeC.filter((p) => p.worthPursuing).slice(0, 5));
  if (a === '/players') {
    const q = (query.get('q') ?? '').toLowerCase();
    return J(everyone.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8));
  }
  m = a.match(/^\/players\/([^/]+)\/valuation$/);
  if (m) return J(valuation(everyone.find((p) => p.id === m[1])));
  m = a.match(/^\/board\/bidder\/([^/]+)$/);
  if (m) {
    const p = everyone.find((x) => x.id === m[1]);
    return J({ playerId: p.id, name: p.name, team: p.team, role: p.role, listPrice: p.listPrice, timerSeconds: 5, beepEnabled: false });
  }
  unknown.add(`${method} ${path}`);
  return J({ detail: 'x' }, 404);
}

const browser = await chromium.launch();
const wide = [];

async function open(viewport, authed) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'it-IT' });
  await context.addCookies([{ name: 'XSRF-TOKEN', value: 'x', url: BASE }]);
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('errore nella pagina:', e.message));
  await page.route((url) => url.pathname.startsWith('/api/'), (route) => {
    const url = new URL(route.request().url());
    const r = respond(route.request().method(), url.pathname, url.searchParams, authed);
    return route.fulfill({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.body) });
  });
  return { context, page };
}

async function shot(page, name, path, after) {
  if (path) await page.goto(BASE + path, { waitUntil: 'networkidle' });
  if (after) await after(page);
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, 0));
  // Una pagina che scorre di lato e' un difetto su qualunque schermo.
  const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (extra > 0) wide.push(`${name} (+${extra}px)`);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log('ok', name);
}

const DESK = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

for (const [vp, tag] of [[DESK, 'desktop'], [PHONE, 'telefono']]) {
  const anon = await open(vp, false);
  await shot(anon.page, `01-accedi-${tag}`, '/accedi');
  await shot(anon.page, `02-registrati-${tag}`, '/registrati');
  await shot(anon.page, `03-password-dimenticata-${tag}`, '/password-dimenticata');
  await shot(anon.page, `04-nuova-password-${tag}`, '/nuova-password?token=abc');
  await shot(anon.page, `05-verifica-email-${tag}`, '/verifica-email?token=abc');
  await shot(anon.page, `06-invito-${tag}`, '/invito/abcdefghijklmnop1234');
  await shot(anon.page, `07-errore-${tag}`, '/pagina-che-non-esiste');
  await anon.context.close();

  const user = await open(vp, true);
  await shot(user.page, `08-le-mie-leghe-${tag}`, '/');
  await shot(user.page, `08b-le-mie-leghe-ricerca-${tag}`, null, async (p) => {
    await p.getByLabel('Cerca la lega').fill('lega bar');
    await p.waitForTimeout(600);
  });
  await shot(user.page, `09-lega-${tag}`, '/leghe/L1');
  await shot(user.page, `10-regole-lega-${tag}`, '/leghe/L1/regole');
  await shot(user.page, `11-importa-${tag}`, '/leghe/L1/importa');
  await shot(user.page, `12-profilo-${tag}`, '/profilo');
  await shot(user.page, `15-impostazioni-asta-${tag}`, '/leghe/L1/aste/A1/impostazioni');
  await shot(user.page, `16-proiezione-${tag}`, '/leghe/L1/aste/A1/proiezione');
  await shot(user.page, `13-asta-riposo-${tag}`, '/leghe/L1/aste/A1');
  await shot(user.page, `14-asta-giocatore-${tag}`, null, async (p) => {
    await p.getByText(freeC[0].name, { exact: true }).first().click();
    await p.waitForTimeout(600);
  });
  await shot(user.page, `14b-asta-conto-${tag}`, null, async (p) => {
    await p.getByRole('button', { name: 'Avvia il conto alla rovescia' }).click();
    await p.waitForTimeout(1200);
  });
  await shot(user.page, `14d-asta-scaduto-${tag}`, null, async (p) => {
    await p.waitForTimeout(6000);
  });
  await shot(user.page, `14c-asta-rose-${tag}`, '/leghe/L1/aste/A1', async (p) => {
    await p.getByRole('tab', { name: 'Rose squadre' }).click();
    await p.waitForTimeout(600);
  });
  await user.context.close();
}
await browser.close();
console.log('larghe:', wide);
console.log('non gestite:', [...unknown]);
```

- [ ] **Step 2: Aggiungere il comando**

In `frontend/package.json`, dentro `"scripts"`, dopo `"tokens"`:

```json
    "screens": "node scripts/screens.mjs",
```

- [ ] **Step 3: Avviare Vite e fotografare lo stato di partenza**

```bash
cd frontend
npm run dev          # in un altro terminale; leggere la porta dal log
npm run screens -- test-results/screens/prima
```

Expected: 40 righe `ok …` (20 per viewport), poi `larghe: [ '16-proiezione-telefono (+16px)' ]` (la proiezione sul telefono scorre di lato già oggi) e `non gestite: []`. `non gestite` deve essere vuoto: se c'è una voce, aggiungere la risposta in `respond` prima di andare avanti. Se Vite è partito su un'altra porta: `BASE=http://localhost:5175 npm run screens -- test-results/screens/prima`. La cartella `test-results/` è già in `.gitignore`.

Aprire tre immagini a caso (`13-asta-riposo-desktop.png`, `09-lega-telefono.png`, `01-accedi-desktop.png`) e controllare che mostrino le pagine vere con dati, non una pagina bianca né «Un attimo…».

- [ ] **Step 4: Documentarlo**

In `frontend/README.md`, dopo la sezione «Test», aggiungere:

````markdown
## Guardare le schermate

Le prove in jsdom non dicono niente su proporzioni, vuoti e colori. `npm run screens`
fotografa ogni pagina a 1440×900 e a 390×844 rispondendo al posto del backend, quindi
non serve `./run.sh` e non si creano aste vere:

```bash
npm run dev                                   # in un altro terminale
npm run screens -- test-results/screens/dopo  # un PNG per pagina
```

In fondo stampa le pagine che scorrono di lato e le chiamate a cui non ha saputo
rispondere. Se Vite non è sulla 5173: `BASE=http://localhost:5175 npm run screens`.
````

- [ ] **Step 5: Commit**

```bash
git add frontend/scripts/screens.mjs frontend/package.json frontend/README.md
git commit -m "Uno script che fotografa ogni pagina senza backend

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: La palette di Club Notturno

**Files:**
- Modify: `frontend/src/styles/contrast.test.ts` (il blocco `PAIRS` e il nome del `describe`)
- Modify: `frontend/scripts/palette.mjs` (gli oggetti `PALETTE` e `LINES`)
- Modify: `frontend/src/styles/tokens.css` (rigenerato, non a mano)
- Modify: `frontend/src/index.css` (`.pitch-grass`, il commento di `panel`)
- Modify: `frontend/src/domain/BidderDialog.tsx:546` (la barra del tempo)

**Interfaces:**
- Produces: i token Tailwind `bg-bar`, `border-control-border`, `bg-grass` (e le rispettive varianti `text-`, `border-`), oltre a quelli che esistono già. `PALETTE.grass`, `PALETTE.bar`, `PALETTE['control-border']` in `palette.mjs`.

- [ ] **Step 1: Riscrivere le coppie di contrasto**

In `frontend/src/styles/contrast.test.ts` sostituire l'intero array `PAIRS` con:

```ts
const PAIRS: Array<[keyof typeof PALETTE, keyof typeof PALETTE, number]> = [
  // Il testo, su ognuno dei quattro fondi su cui puo' poggiare.
  ['foreground', 'background', 4.5],
  ['foreground', 'bar', 4.5],
  ['foreground', 'surface', 4.5],
  ['foreground', 'surface-raised', 4.5],
  ['muted-foreground', 'background', 4.5],
  ['muted-foreground', 'bar', 4.5],
  ['muted-foreground', 'surface', 4.5],
  ['muted-foreground', 'surface-raised', 4.5],
  ['accent', 'bar', 4.5],
  ['accent', 'surface', 4.5],
  ['accent', 'surface-raised', 4.5],
  ['positive', 'surface', 4.5],
  ['positive', 'surface-raised', 4.5],
  ['destructive', 'surface', 4.5],
  ['destructive', 'surface-raised', 4.5],
  ['on-accent', 'accent', 4.5],
  ['on-accent', 'positive', 4.5],
  ['on-accent', 'destructive', 4.5],
  ['role-p', 'surface', 4.5],
  ['role-d', 'surface', 4.5],
  ['role-c', 'surface', 4.5],
  ['role-a', 'surface', 4.5],
  // Il bordo di cio' che si preme e di cio' in cui si scrive. Il bordo dei
  // pannelli (panel-border) non e' qui apposta: senza erba dietro un pannello non
  // e' un controllo, lo distingue la sua luminosita', e la soglia dei componenti
  // (3:1) vale per i controlli.
  ['control-border', 'background', 3],
  ['control-border', 'bar', 3],
  ['control-border', 'surface', 3],
  ['control-border', 'surface-raised', 3],
  // L'erba resta nella meta' campo delle pagine d'ingresso, e il marchio ci poggia.
  ['foreground', 'grass', 4.5],
  ['foreground', 'grass-stripe', 4.5],
  ['accent', 'grass', 3],
  ['accent', 'grass-stripe', 3],
];
```

E nella stessa file cambiare `describe('palette Campo', () => {` in `describe('palette Club Notturno', () => {`.

- [ ] **Step 2: Vedere la prova fallire**

Run: `npm test -- src/styles/contrast.test.ts`
Expected: FAIL. Le righe con `bar`, `control-border` e `grass` falliscono perché `PALETTE[...]` è `undefined` (errore dentro `hexToRgb`).

- [ ] **Step 3: Cambiare la palette**

In `frontend/scripts/palette.mjs` sostituire gli oggetti `PALETTE` e `LINES` (lasciando intatte le funzioni sotto) con:

```js
export const PALETTE = {
  // Il fondo della finestra: uniforme, quasi nero con una punta di verde. L'erba a
  // strisce non e' piu' qui — vedi grass, in fondo.
  background:         '#07130E',
  // Le barre: quella di navigazione in alto, e quella in basso sul telefono.
  bar:                '#0A1A12',
  // Il pannello: pieno, mai trasparente. Si stacca dal fondo per luminosita'; il
  // bordo lo rifinisce, non lo regge.
  surface:            '#0D2117',
  'panel-border':     '#274636',
  // Il bordo di bottoni secondari e campi: almeno 3:1 su ogni fondo, verificato da
  // contrast.test.ts. E' cio' che dice «questo si preme, qui si scrive».
  'control-border':   '#5F8F75',
  // Cio' che e' scelto o e' tuo dentro un pannello: la riga selezionata, la tua
  // squadra, la casella dell'offerta.
  'surface-raised':   '#143020',
  foreground:         '#F3F6F2',
  'muted-foreground': '#A7B8AD',
  accent:             '#F5B942',
  'on-accent':        '#1B1400',
  positive:           '#4ED187',
  destructive:        '#F06A6A',
  // I quattro ruoli. NON riusano positive e destructive nonostante la
  // somiglianza cromatica (il difensore e' verde, l'attaccante e' rosso): sono
  // coincidenze, non lo stesso significato. Il giorno in cui "positivo"
  // diventasse blu, i difensori non devono seguirlo.
  'role-p':           '#FFB84D',
  'role-d':           '#55D98A',
  'role-c':           '#63B3FF',
  'role-a':           '#FF6F91',
  // Lo stemma di ogni lega: un colore per riconoscerla a colpo d'occhio, scelto
  // dall'identificativo. Tinte lontane dai quattro ruoli e dall'accento, perche'
  // uno stemma «P» non deve sembrare il badge dei portieri. Lettera scura sopra
  // (on-accent).
  'crest-1':          '#7FD1C7',
  'crest-2':          '#B9A8F0',
  'crest-3':          '#B5DB6A',
  'crest-4':          '#E3C9A0',
  'crest-5':          '#D9A6D9',
  'crest-6':          '#A7B7D6',
  // L'erba, con le strisce di taglio: solo la meta' campo delle pagine d'ingresso
  // (HalfPitch). E' la firma del prodotto, non piu' lo sfondo di ogni pagina.
  grass:              '#2E6B34',
  'grass-stripe':     '#29612F',
};

// Divisori dentro i pannelli (line, line-strong) e il gesso delle linee del
// campo (chalk): bianco con alfa, perché il loro senso è "la stessa linea, più o
// meno marcata", non tre colori diversi. Piu' tenui di prima: su un fondo scuro e
// uniforme una linea al 25% si leggeva come un bordo, non come un divisore.
export const LINES = {
  line:          'rgba(255,255,255,0.09)',
  'line-strong': 'rgba(255,255,255,0.18)',
  // Solo le righe della meta' campo d'ingresso.
  chalk:         'rgba(255,255,255,0.4)',
};
```

- [ ] **Step 4: Rigenerare i token**

Run: `npm run tokens`
Expected: `tokens.css rigenerato`. `git diff --stat src/styles/tokens.css` mostra il file cambiato.

- [ ] **Step 5: L'erba legge il suo token**

In `frontend/src/index.css` sostituire le tre regole di `.pitch-grass` con:

```css
.pitch-grass {
  background-color: var(--grass);
  background-image: linear-gradient(90deg, var(--grass) 50%, var(--grass-stripe) 50%);
  background-size: calc(200% / 12) 100%;
}
@media (orientation: portrait) {
  .pitch-grass {
    background-image: linear-gradient(180deg, var(--grass) 50%, var(--grass-stripe) 50%);
    background-size: 100% calc(200% / 12);
  }
}
```

E sostituire il commento sopra `@utility panel` con:

```css
/* Il pannello: tutto cio' che si legge sta qui dentro. Pieno, e un gradino piu'
   chiaro del fondo: e' la luminosita' a staccarlo, il bordo lo rifinisce. */
```

- [ ] **Step 6: La barra del tempo non sparisce**

`panel-border` ora è quasi invisibile su una traccia, e la barra del conto alla rovescia lo usava come riempimento. In `frontend/src/domain/BidderDialog.tsx` cambiare

```tsx
            className={`h-full ${urgent ? 'bg-destructive' : 'bg-panel-border'}`}
```

in

```tsx
            className={`h-full ${urgent ? 'bg-destructive' : 'bg-control-border'}`}
```

- [ ] **Step 7: Vedere le prove passare**

Run: `npm test -- src/styles/contrast.test.ts`
Expected: PASS, comprese «tokens.css è rigenerato dalla palette corrente» e quella delle opacità.

Run: `npm test`
Expected: PASS. Se una prova cerca `bg-panel-border` sulla barra del tempo, aggiornarla a `bg-control-border`.

- [ ] **Step 8: Commit**

```bash
git add frontend/scripts/palette.mjs frontend/src/styles/tokens.css frontend/src/styles/contrast.test.ts frontend/src/index.css frontend/src/domain/BidderDialog.tsx
git commit -m "La palette di Club Notturno: fondo uniforme, bordo dei controlli a 3:1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: L'erba esce dall'app

**Files:**
- Modify: `frontend/src/AppFrame.tsx`, `frontend/src/AppFrame.test.tsx`
- Modify: `frontend/src/domain/PitchGrass.tsx`
- Modify: `frontend/src/domain/HalfPitch.tsx`; Create: `frontend/src/domain/HalfPitch.test.tsx`
- Create: `frontend/src/domain/PageFrame.tsx`, `frontend/src/domain/PageFrame.test.tsx`, `frontend/src/domain/Crest.tsx`
- Delete: `frontend/src/domain/PitchFrame.tsx`
- Modify: `frontend/src/routes/LeaguesRoute.tsx`, `LeagueRoute.tsx`, `LeagueRulesRoute.tsx`, `ImportRoute.tsx`, `ProfileRoute.tsx`, `AuctionSettingsRoute.tsx`
- Modify: `frontend/src/index.css` (via `pitch-frame`)

**Interfaces:**
- Produces: `PageFrame({ children })` da `domain/PageFrame`; `Crest({ id, name, muted?, size? })` da `domain/Crest` (stessa firma di prima). `HalfwayLine` e `PitchFrame` non esistono più.

- [ ] **Step 1: Le prove della cornice**

Sostituire il contenuto di `frontend/src/AppFrame.test.tsx` con:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppFrame } from './AppFrame';

function withRoutes(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppFrame />}>
          <Route path="/" element={<><p>home</p><Link to="/asta">vai</Link></>} />
          <Route path="/asta" element={<p>asta</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppFrame', () => {
  // L'erba a strisce non copre piu' la finestra: resta solo nella meta' campo
  // delle pagine d'ingresso.
  it('il fondo e uniforme: nessun campo dietro le pagine', () => {
    const { container, getByTestId } = withRoutes();
    expect(container.querySelector('[data-testid="pitch"]')).toBeNull();
    expect(getByTestId('app-frame').className).toContain('bg-background');
  });

  it('mostra dentro di se la pagina della rotta', () => {
    withRoutes();
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('cambiando pagina la cornice resta lo stesso elemento, non viene rifatta', async () => {
    const { getByTestId } = withRoutes();
    const before = getByTestId('app-frame');

    await userEvent.click(screen.getByRole('link', { name: 'vai' }));

    expect(screen.getByText('asta')).toBeInTheDocument();
    expect(getByTestId('app-frame')).toBe(before);
  });
});
```

Creare `frontend/src/domain/HalfPitch.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HalfPitch } from './HalfPitch';

describe('HalfPitch', () => {
  // L'erba vive solo qui: e' la firma delle pagine d'ingresso. Sul telefono la
  // meta' campo non c'e', e l'erba con lei.
  it('porta con se la sua erba, solo da schermo largo', () => {
    const { getAllByTestId } = render(<HalfPitch><p>dentro</p></HalfPitch>);
    const pitch = getAllByTestId('pitch');
    expect(pitch).toHaveLength(1);
    expect(pitch[0].className).toContain('pitch-grass');
    expect(pitch[0].className).toContain('max-lg:hidden');
    // Dentro la sua colonna, non su tutta la finestra.
    expect(pitch[0].className).toContain('absolute');
    expect(pitch[0].className).not.toContain('fixed');
  });
});
```

Creare `frontend/src/domain/PageFrame.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageFrame } from './PageFrame';

describe('PageFrame', () => {
  it('contiene la pagina, centrata e non piu larga di 96rem', () => {
    const { container } = render(<PageFrame><p>contenuto</p></PageFrame>);
    expect(screen.getByText('contenuto')).toBeInTheDocument();
    expect(container.firstElementChild?.className).toContain('max-w-[96rem]');
    expect(container.firstElementChild?.className).toContain('mx-auto');
  });

  // Niente perimetro in gesso, niente archi d'angolo: il campo non incornicia piu'
  // le pagine dell'app.
  it('non disegna nessuna riga del campo', () => {
    const { container } = render(<PageFrame><p>x</p></PageFrame>);
    expect(container.querySelector('[aria-hidden]')).toBeNull();
    expect(container.innerHTML).not.toContain('chalk');
  });
});
```

- [ ] **Step 2: Vederle fallire**

Run: `npm test -- src/AppFrame.test.tsx src/domain/HalfPitch.test.tsx src/domain/PageFrame.test.tsx`
Expected: FAIL. `AppFrame`: `app-frame` non trovato e il campo c'è ancora. `HalfPitch`: nessun `pitch`. `PageFrame`: modulo inesistente.

- [ ] **Step 3: La cornice senza erba**

Sostituire il contenuto di `frontend/src/AppFrame.tsx` con:

```tsx
import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';

/**
 * La cornice dell'applicazione: il fondo, e dentro la pagina.
 *
 * <p>Sta in una rotta di livello superiore e non dentro AppShell perche' non deve
 * essere ricostruita a ogni cambio di pagina: cambiando rotta React smonta la
 * vecchia e monta la nuova, e qui resta montato cio' che non cambia.
 *
 * <p>Il fondo e' uniforme. L'erba a strisce, che prima copriva tutta la finestra,
 * vive solo nella meta' campo delle pagine d'ingresso ({@code HalfPitch}).
 *
 * <p>{@code children} al posto della rotta: la pagina d'errore del router, che
 * sostituisce la cornice intera.
 */
export function AppFrame({ children }: { children?: ReactNode }) {
  return (
    <div data-testid="app-frame" className="min-h-dvh bg-background font-sans text-foreground">
      {children ?? <Outlet />}
    </div>
  );
}
```

- [ ] **Step 4: L'erba nella metà campo**

In `frontend/src/domain/PitchGrass.tsx` cambiare la classe `fixed` in `absolute`:

```tsx
      className={`pitch-grass pointer-events-none absolute z-0 ${className}`}
```

e sostituire il primo paragrafo del commento in testa (da «L'erba dietro ogni schermata» fino a «non hanno pezzi da tagliare.») con:

```tsx
/**
 * L'erba a strisce della meta' campo delle pagine d'ingresso: strisce di taglio, e
 * nient'altro. Prima copriva tutta la finestra dietro ogni schermata; ora il fondo
 * dell'app e' uniforme e l'erba resta qui, come firma del prodotto.
 *
 * <p>Riempie l'antenato posizionato piu' vicino ({@code absolute}), non la
 * finestra: chi la monta decide dove sta.
```

In `frontend/src/domain/HalfPitch.tsx` aggiungere l'import e l'erba come primo figlio del contenitore esterno, che diventa posizionato:

```tsx
import type { ReactNode } from 'react';
import { PitchGrass } from './PitchGrass';
```

```tsx
export function HalfPitch({ children }: { children: ReactNode }) {
  return (
    <div className="max-lg:contents lg:relative lg:col-start-2 lg:row-start-1 lg:flex lg:items-center lg:justify-center">
      {/* L'erba riempie la colonna di destra, e solo quella. Sul telefono la meta'
          campo non c'e' e i figli entrano nella griglia della pagina: niente erba. */}
      <PitchGrass className="inset-0 max-lg:hidden" />
      <div className={`max-lg:contents lg:relative lg:aspect-[68/52.5] lg:[container-type:inline-size] ${SIZE}`}>
```

Il resto del file resta com'è.

- [ ] **Step 5: `PageFrame` e `Crest`**

```bash
cd frontend/src/domain
git mv PitchFrame.tsx PageFrame.tsx
```

Creare `frontend/src/domain/Crest.tsx` spostandoci, senza cambiarli, la costante `CRESTS` e la funzione `Crest` con il suo commento, che ora stanno in fondo a `PageFrame.tsx`. Il file comincia con:

```tsx
// Scritte per intero: Tailwind trova le classi leggendo il sorgente.
const CRESTS = ['bg-crest-1', 'bg-crest-2', 'bg-crest-3', 'bg-crest-4', 'bg-crest-5', 'bg-crest-6'];
```

seguito da `export function Crest(...)` identica a prima.

Poi sostituire l'intero contenuto di `frontend/src/domain/PageFrame.tsx` con:

```tsx
import type { ReactNode } from 'react';

/**
 * Il contenitore delle pagine dell'app: largo al massimo 96rem, centrato, alto
 * almeno quanto la finestra sotto la barra, cosi' chi sta dentro puo' riempirla o
 * centrarsi.
 *
 * <p>Era il perimetro in gesso di un campo, con gli archi d'angolo. Il campo non
 * incornicia piu' le pagine: resta nella meta' campo delle pagine d'ingresso.
 */
export function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-var(--header-h)-2rem)] w-full max-w-[96rem] flex-col md:min-h-[calc(100dvh-var(--header-h)-3rem)]">
      {children}
    </div>
  );
}
```

- [ ] **Step 6: Le rotte usano i nomi nuovi**

```bash
cd frontend/src/routes
sed -i '' -e 's/PitchFrame/PageFrame/g' LeaguesRoute.tsx LeagueRoute.tsx LeagueRulesRoute.tsx ImportRoute.tsx ProfileRoute.tsx AuctionSettingsRoute.tsx
```

In `LeaguesRoute.tsx` e in `LeagueRoute.tsx` la riga d'import, che dopo il `sed` è

```tsx
import { Crest, HalfwayLine, PageFrame } from '../domain/PageFrame';
```

diventa

```tsx
import { Crest } from '../domain/Crest';
import { PageFrame } from '../domain/PageFrame';
```

In entrambi i file togliere la riga `<HalfwayLine />` e cambiare la griglia che la conteneva da

```tsx
        <div className="grid flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)]">
```

a

```tsx
        <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-2">
```

In `LeagueRulesRoute.tsx` l'altezza del riquadro contava anche il margine interno della cornice in gesso, che non c'è più. In entrambe le occorrenze (lo scheletro e la pagina pronta)

```tsx
md:h-[calc(100dvh-var(--header-h)-7rem-4px)]
```

diventa

```tsx
md:h-[calc(100dvh-var(--header-h)-3rem)]
```

Nei sei file, i commenti che parlano di «campo», «erba», «metà campo» o «linee in gesso» a proposito di queste pagine vanno riscritti per dire quello che c'è adesso: due colonne su un fondo uniforme.

- [ ] **Step 7: Via l'utility del campo**

In `frontend/src/index.css` togliere il blocco `@utility pitch-frame { … }` con il commento che lo precede («La colonna della home. La misura nasce dalle linee in gesso…»), e nel commento sopra `--header-h` togliere le parole «— pitch-frame qui sotto, la colonna della home».

- [ ] **Step 8: Vedere le prove passare**

Run: `npm test -- src/AppFrame.test.tsx src/domain/HalfPitch.test.tsx src/domain/PageFrame.test.tsx src/domain/PitchGrass.test.tsx`
Expected: PASS.

Run: `npm test && npm run build`
Expected: PASS entrambi. `tsc` segnala subito un import rimasto su `PitchFrame` o `HalfwayLine`.

- [ ] **Step 9: Commit**

```bash
git add -A frontend/src
git commit -m "L'erba resta solo nella metà campo d'ingresso; le pagine poggiano su un fondo uniforme

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Le forme

Oggi nel sorgente ci sono 64 `rounded-full`, 47 `rounded-2xl` e 37 `rounded-xl`: tutto è una pillola. Questo task è meccanico, e va tenuto separato dagli altri: se una prova diventa rossa qui, dice una cosa sola.

**Files:**
- Create: `frontend/src/styles/shapes.test.ts`
- Modify: `frontend/src/domain/controls.ts`
- Modify: `frontend/src/index.css` (`panel`)
- Modify: `frontend/src/domain/AuthForm.tsx`, `frontend/src/routes/LeaguesRoute.tsx`, `LeagueRoute.tsx`, `AuctionSettingsRoute.tsx`
- Modify: ogni `.tsx` sotto `frontend/src` che usa `rounded-2xl`, `rounded-xl`, `rounded-full` o `border-line-strong` su un controllo (sostituzione meccanica)
- Modify: `frontend/src/domain/PhaseTargets.test.tsx:73,130`

**Interfaces:**
- Produces, da `domain/controls.ts`: `BUTTON_PRIMARY`, `BUTTON_SECONDARY`, `BUTTON_DESTRUCTIVE`, `FIELD` (stringhe di classi). `BID_RADIUS` vale `'rounded-lg'`. L'utility `panel` porta il raggio: chi la usa non scrive `rounded-*`.

- [ ] **Step 1: La prova che legge il sorgente**

Creare `frontend/src/styles/shapes.test.ts`:

```ts
// @vitest-environment node
//
// Come weights.test.ts, legge i sorgenti da disco: «tutto e' una pillola» non e' il
// difetto di un componente, e' il rapporto fra tutti.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('..', import.meta.url).pathname;

/**
 * Dove la pillola e' ammessa, e perche': solo cio' che e' uno stato o un'etichetta.
 * Bottoni, campi e pannelli hanno il raggio da 8px. Una voce in piu' qui e' una
 * deroga da giustificare, non una scappatoia.
 */
const PILLS = new Map([
  // Il distintivo del ruolo: una lettera in un tondo.
  ['domain/RoleBadge.tsx', 1],
  // Il pallino dello stato della connessione.
  ['domain/ConnectionStatus.tsx', 1],
  // Il conteggio delle richieste da decidere, e il numero dei passi «come si comincia».
  ['routes/LeaguesRoute.tsx', 2],
  // L'iniziale di un membro.
  ['routes/LeagueRoute.tsx', 1],
  // La riga dello scheletro mentre le regole si caricano.
  ['routes/LeagueRulesRoute.tsx', 1],
]);

function sources(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sources(path, found);
    else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) found.push(path);
  }
  return found;
}

describe('le forme', () => {
  it('nessun raggio oltre gli 8px: pannelli, bottoni e campi sono rounded-lg', () => {
    const offenders: string[] = [];
    for (const file of sources(SRC)) {
      const found = readFileSync(file, 'utf8').match(/rounded-(?:[a-z]{1,2}-)?(?:xl|2xl|3xl)\b/g);
      if (found) offenders.push(`${file.slice(SRC.length)}: ${found.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('la pillola resta a cio che e uno stato o un etichetta', () => {
    const offenders: string[] = [];
    for (const file of sources(SRC)) {
      const relative = file.slice(SRC.length);
      const count = (readFileSync(file, 'utf8').match(/rounded-full/g) ?? []).length;
      const allowed = PILLS.get(relative) ?? 0;
      if (count > allowed) offenders.push(`${relative}: ${count} rounded-full, ne sono ammessi ${allowed}`);
    }
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Vederla fallire**

Run: `npm test -- src/styles/shapes.test.ts`
Expected: FAIL, con l'elenco dei file che portano `rounded-2xl`/`rounded-xl` e di quelli con troppe `rounded-full`.

- [ ] **Step 3: La sostituzione meccanica dei raggi**

```bash
cd frontend/src
FILES=$(grep -rlE --include='*.tsx' --include='*.ts' 'rounded-(b-)?(2xl|xl|full)' . | grep -v '\.test\.' | grep -v -e 'RoleBadge.tsx' -e 'ConnectionStatus.tsx')
sed -i '' -E -e 's/rounded-b-2xl/rounded-b-lg/g' -e 's/rounded-(2xl|xl|full)/rounded-lg/g' $FILES
```

Poi rimettere la pillola nei quattro posti in cui è uno stato o un'etichetta:

In `routes/LeaguesRoute.tsx`, il conteggio delle richieste:

```tsx
          <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-on-accent">
```

e il numero dei passi (`FirstSteps`): nella riga che comincia con `<span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-lg` rimettere `rounded-full`.

In `routes/LeagueRoute.tsx`, l'iniziale del membro: nella riga `<span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg` rimettere `rounded-full`.

In `routes/LeagueRulesRoute.tsx`, lo scheletro:

```tsx
                  <span className="h-4 w-32 rounded-full bg-line" />
```

- [ ] **Step 4: Il pannello porta il suo raggio**

In `frontend/src/index.css`:

```css
@utility panel {
  background-color: var(--color-surface);
  border: 1px solid var(--color-panel-border);
  border-radius: var(--radius-lg);
}
```

E togliere il raggio ripetuto da chi usa `panel`:

```bash
cd frontend/src
sed -i '' -E '/["`{ ]panel /s/ rounded-lg//' $(grep -rl --include='*.tsx' 'panel ' . | grep -v '\.test\.')
grep -rnE --include='*.tsx' '["`{ ]panel [^"`]*rounded-' . | grep -v '\.test\.'
```

Expected dell'ultimo `grep`: nessuna riga. Se ne resta una, togliere a mano la classe `rounded-*` da quell'elemento.

- [ ] **Step 5: Le classi dei controlli, in un posto solo**

In `frontend/src/domain/controls.ts` cambiare

```ts
export const BID_RADIUS = 'rounded-2xl';
```

in `export const BID_RADIUS = 'rounded-lg';` (il `sed` dello Step 3 l'ha già fatto: verificare) e aggiungere in fondo al file:

```ts
const BUTTON_SHAPE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 disabled:opacity-50';

/**
 * L'azione principale della schermata: una sola per schermata porta l'oro. Il
 * contorno di messa a fuoco e' chiaro e non oro, perche' oro su oro non si vede.
 */
export const BUTTON_PRIMARY =
  `${BUTTON_SHAPE} bg-accent font-semibold text-on-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground`;

/** Ogni altra azione: contorno e nient'altro. */
export const BUTTON_SECONDARY =
  `${BUTTON_SHAPE} border border-control-border font-medium hover:bg-line ${FOCUS_RING}`;

/** Cio' che non si puo' annullare: togliere, eliminare, uscire. */
export const BUTTON_DESTRUCTIVE =
  `${BUTTON_SHAPE} bg-destructive font-semibold text-on-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground`;

/** Un campo di testo: 48px, col bordo dei controlli. */
export const FIELD =
  `min-h-12 w-full rounded-lg border border-control-border bg-surface px-4 text-base placeholder:text-muted-foreground ${FOCUS_RING}`;
```

`FOCUS_RING` è dichiarata più su nello stesso file: le costanti nuove vanno dopo di lei.

In `frontend/src/domain/AuthForm.tsx`:

```tsx
import { BUTTON_PRIMARY, FIELD } from './controls';
```

l'`<input>` di `TextField` prende `className={`mt-2 ${FIELD}`}` al posto della stringa scritta per intero, e in fondo:

```tsx
export const PRIMARY_BUTTON = `mt-6 w-full ${BUTTON_PRIMARY}`;
```

In `frontend/src/routes/LeaguesRoute.tsx` la costante in testa diventa:

```tsx
import { BUTTON_SECONDARY } from '../domain/controls';

const SECONDARY_BUTTON = `shrink-0 text-sm ${BUTTON_SECONDARY}`;
```

In `frontend/src/routes/LeagueRoute.tsx`:

```tsx
import { BUTTON_SECONDARY } from '../domain/controls';

const SECONDARY_BUTTON = BUTTON_SECONDARY;
```

In `frontend/src/routes/AuctionSettingsRoute.tsx` le due costanti `BUTTON` e `PRIMARY` (righe 11–14) tengono il nome e perdono la stringa scritta per intero. Si aggiunge l'import:

```tsx
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '../domain/controls';
```

e le due righe diventano:

```tsx
const BUTTON = `min-w-11 ${BUTTON_SECONDARY}`;
const PRIMARY = BUTTON_PRIMARY;
```

- [ ] **Step 6: Il bordo dei controlli**

Bottoni e campi oggi hanno `border-line-strong`, che è un divisore (bianco al 18%) e non arriva a 3:1.

```bash
cd frontend/src
sed -i '' -E '/(min-h-(9|11|12|14|16)|h-12 w-12|CONTROL_H)/s/border-line-strong/border-control-border/g' $(grep -rl --include='*.tsx' 'border-line-strong' . | grep -v '\.test\.')
```

I due bottoni di `domain/PhasePager.tsx` hanno addirittura `border-line`, il divisore più tenue: in entrambi `border border-line px-3` diventa `border border-control-border px-3`.

Quattro controlli hanno il bordo su una riga diversa da quella dell'altezza, e vanno cambiati a mano (`border-line-strong` → `border-control-border`):

- `domain/PlayerSearchBox.tsx`, il filtro per ruolo: `: 'border-line-strong text-muted…`
- `domain/ProfileMenu.tsx`: `: 'border-line-strong hover:bg-line'`
- `domain/BidderDialog.tsx`, il bottone di una squadra a tempo scaduto: `picked ? '…' : 'border-line-strong hover:bg-line'`
- `routes/AuctionRoute.tsx`, «Togli dal banco»: `: 'border-line-strong hover:bg-line'`

Verifica:

```bash
grep -rn --include='*.tsx' 'border-line-strong' . | grep -v '\.test\.'
```

Expected: restano solo divisori e riquadri che non si premono — intestazioni di tabella (`border-b border-line-strong`), il tabellone del conto, la sua barra, i `fieldset` e le sezioni di `LeagueRulesFieldset`, `ScoringFieldset`, `SettingsSummary`, il tasto disegnato `KEY_CAP`, lo stemma tratteggiato di `Crest`, il numero dei passi in `LeaguesRoute`, il piede di `LeagueRulesRoute`.

- [ ] **Step 7: Le due prove che affermavano il raggio vecchio**

In `frontend/src/domain/PhaseTargets.test.tsx`, alle righe 73 e 130:

```tsx
      expect(bottone.className).toContain('rounded-lg');
```

- [ ] **Step 8: Vedere le prove passare**

Run: `npm test -- src/styles/shapes.test.ts`
Expected: PASS.

Run: `npm test && npm run build && npm run lint`
Expected: PASS tutti e tre. Una prova che cerca `min-h-11` su un campo di `TextField` va aggiornata a `min-h-12`; nessun'altra dovrebbe muoversi.

- [ ] **Step 9: Commit**

```bash
git add -A frontend/src
git commit -m "Raggi da 8px e pillola solo per gli stati; le classi dei controlli in un posto solo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: La misura minima del testo

**Files:**
- Create: `frontend/src/styles/sizes.test.ts`
- Modify: `frontend/src/index.css` (`@theme`)
- Modify: i `.tsx` sotto `frontend/src` che usano `text-xs` (sostituzione meccanica)
- Modify: `frontend/src/domain/PhaseSwitcher.test.tsx:47`, `frontend/src/domain/RoleBadge.test.tsx:33`

**Interfaces:**
- Produces: le utility Tailwind `text-meta` (13px, interlinea 18px) e `text-body` (15px, interlinea 22px).

- [ ] **Step 1: La prova**

Creare `frontend/src/styles/sizes.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('..', import.meta.url).pathname;

/**
 * Dove i 12px sono ammessi, e perche': solo cio' che e' decorazione o ripete a
 * parole qualcosa detto altrove. Vuoto oggi. Una voce qui e' una deroga da
 * giustificare una per una, sul modello di DECORATIVE in contrast.test.ts.
 */
const SMALL = new Map<string, number>([]);

function sources(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sources(path, found);
    else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) found.push(path);
  }
  return found;
}

describe('la misura del testo', () => {
  // Seconde righe, etichette e note erano a 12px su verde scuro: si leggevano a
  // fatica sul portatile e per niente sul telefono. La misura piu' piccola per un
  // testo che informa e' text-meta, 13px.
  it('nessun testo che informa scende sotto i 13px', () => {
    const offenders: string[] = [];
    for (const file of sources(SRC)) {
      const relative = file.slice(SRC.length);
      const count = (readFileSync(file, 'utf8').match(/\btext-xs\b/g) ?? []).length;
      const allowed = SMALL.get(relative) ?? 0;
      if (count > allowed) offenders.push(`${relative}: ${count} text-xs, ne sono ammessi ${allowed}`);
    }
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Vederla fallire**

Run: `npm test -- src/styles/sizes.test.ts`
Expected: FAIL, con dieci file elencati (nove componenti dell'asta e `routes/LeaguesRoute.tsx`).

- [ ] **Step 3: Le due misure nuove**

In `frontend/src/index.css`, subito dopo `@import './styles/tokens.css';`:

```css
/* Due misure fra quelle di Tailwind. text-meta e' la piu' piccola per un testo che
   informa: etichette, seconde righe, note. text-body e' la riga di un elenco o di
   una tabella: un gradino sopra text-sm, che su fondo scuro risultava minuto. */
@theme {
  --text-meta: 0.8125rem;
  --text-meta--line-height: 1.125rem;
  --text-body: 0.9375rem;
  --text-body--line-height: 1.375rem;
}
```

- [ ] **Step 4: La sostituzione**

```bash
cd frontend/src
sed -i '' 's/text-xs/text-meta/g' $(grep -rl --include='*.tsx' --include='*.ts' 'text-xs' . | grep -v '\.test\.')
grep -rn --include='*.tsx' --include='*.ts' 'text-xs' . | grep -v '\.test\.'
```

Expected dell'ultimo `grep`: nessuna riga.

- [ ] **Step 5: Le due prove che affermavano la misura vecchia**

`frontend/src/domain/PhaseSwitcher.test.tsx:47`:

```tsx
    expect(altra.querySelector('span')?.className).toContain('text-meta');
```

`frontend/src/domain/RoleBadge.test.tsx:33`:

```tsx
    expect(container.firstElementChild?.className).toContain('text-meta');
```

- [ ] **Step 6: Vedere le prove passare**

Run: `npm test && npm run build`
Expected: PASS entrambi.

- [ ] **Step 7: Commit**

```bash
git add -A frontend/src
git commit -m "Nessun testo sotto i 13px: text-meta al posto di text-xs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Due barre e il percorso

**Files:**
- Modify: `frontend/src/AppShell.tsx`, `frontend/src/AppShell.test.tsx`
- Modify: `frontend/src/api/leagues.ts`; Create: `frontend/src/api/useLeagueName.test.tsx`
- Modify: `frontend/src/index.css` (`--header-h`)
- Modify: `frontend/src/routes/LeaguesRoute.tsx`, `LeagueRoute.tsx`, `LeagueRulesRoute.tsx`, `ImportRoute.tsx`, `ProfileRoute.tsx`, `AuctionSettingsRoute.tsx`, `AuctionRoute.tsx`
- Modify: `frontend/src/routes/LeagueRulesRoute.test.tsx:109-113`
- Delete: `frontend/src/domain/BackLink.tsx`

**Interfaces:**
- Produces: `AppShell` accetta `trail?: TrailStep[]`; `export interface TrailStep { label: string; to?: string }` da `AppShell.tsx`. L'ultimo passo è la pagina corrente e non è un collegamento.
- Produces: `useLeagueName(id: string): string | undefined` da `api/leagues.ts` — il nome della lega se è già in cache, senza chiederlo.
- Consumes: `bg-bar` (Task 2), `FOCUS_RING` da `domain/controls.ts`.

- [ ] **Step 1: Le prove della barra**

In `frontend/src/AppShell.test.tsx` sostituire le cinque prove qui elencate. Le altre (`mostra il contenuto…`, `espone la barra superiore come banner`, `ospita lo slot di stato`, `il nome e' il logo`, `con chrome=none…`, `i pulsanti azione appaiono solo…`, `Profilo apre un menu…`) restano come sono.

Al posto di «la barra resta ferma in cima mentre la pagina scorre»:

```tsx
  /** Su una pagina lunga le barre non escono dallo schermo: restano ferme in cima, insieme. */
  it('le barre restano ferme in cima mentre la pagina scorre', () => {
    render(withRouter(<AppShell chrome="top"><p>x</p></AppShell>));
    const bars = screen.getByRole('banner').parentElement;
    expect(bars?.className).toContain('sticky');
    expect(bars?.className).toContain('top-0');
  });
```

Al posto di «porta il marchio e «Le mie leghe»…» e di «sulla home «Le mie leghe» dice di essere la pagina corrente»:

```tsx
  it('senza percorso porta solo il marchio, verso la home', () => {
    render(withRouter(<AppShell chrome="top"><p>x</p></AppShell>));
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/');
    expect(within(links[0]).getByTestId('wordmark')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  const TRAIL = [
    { label: 'Le mie leghe', to: '/' },
    { label: 'Lega del Bar', to: '/leghe/l1' },
    { label: 'Asta estiva' },
  ];

  /**
   * Il percorso dice dove si e' e come si torna indietro, un passo alla volta. I
   * passi prima sono collegamenti; l'ultimo e' la pagina in cui ci si trova, e lo
   * dice a chi ascolta.
   */
  it('il percorso elenca i passi: gli altri sono collegamenti, l ultimo e la pagina corrente', () => {
    render(withRouter(<AppShell chrome="top" trail={TRAIL}><p>x</p></AppShell>));
    const nav = screen.getByRole('navigation', { name: 'Percorso' });
    expect(within(nav).getByRole('link', { name: 'Le mie leghe' })).toHaveAttribute('href', '/');
    expect(within(nav).getByRole('link', { name: 'Lega del Bar' })).toHaveAttribute('href', '/leghe/l1');
    expect(within(nav).queryByRole('link', { name: 'Asta estiva' })).toBeNull();
    expect(within(nav).getByText('Asta estiva')).toHaveAttribute('aria-current', 'page');
  });

  /** Sul telefono non c'e' posto per tutto il percorso: resta il passo da cui si viene. */
  it('sul telefono del percorso resta solo il passo precedente', () => {
    render(withRouter(<AppShell chrome="top" trail={TRAIL}><p>x</p></AppShell>));
    const nav = screen.getByRole('navigation', { name: 'Percorso' });
    const item = (text: string) => within(nav).getByText(text).closest('li');
    expect(item('Le mie leghe')?.className).toContain('max-sm:hidden');
    expect(item('Lega del Bar')?.className).not.toContain('max-sm:hidden');
    expect(item('Asta estiva')?.className).toContain('max-sm:hidden');
  });

  it('la proiezione non ha percorso, nemmeno se glielo si passa', () => {
    render(withRouter(<AppShell chrome="none" trail={TRAIL}><p>x</p></AppShell>));
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
```

Al posto di «sul telefono le azioni della barra stanno su una riga loro, a tutta larghezza»:

```tsx
  /**
   * I comandi della schermata hanno una barra loro, sotto quella di navigazione:
   * nella stessa riga di marchio, percorso e profilo non c'era posto, e sul
   * telefono andavano a capo su tre righe.
   */
  it('i comandi della schermata stanno in una barra loro, fuori da quella di navigazione', () => {
    render(withRouter(
      <AppShell chrome="top" slotActions={<button type="button">azione</button>}><p>x</p></AppShell>,
    ));
    const commands = screen.getByRole('group', { name: 'Comandi della pagina' });
    expect(within(commands).getByRole('button', { name: 'azione' })).toBeInTheDocument();
    expect(within(screen.getByRole('banner')).queryByRole('button', { name: 'azione' })).toBeNull();
  });

  it('senza comandi la seconda barra non c e', () => {
    render(withRouter(<AppShell chrome="top"><p>x</p></AppShell>));
    expect(screen.queryByRole('group', { name: 'Comandi della pagina' })).toBeNull();
  });
```

Creare `frontend/src/api/useLeagueName.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LEAGUE_KEYS, useLeagueName } from './leagues';

function wrapperWith(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useLeagueName', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('legge il nome dalla pagina della lega gia caricata', () => {
    const client = new QueryClient();
    client.setQueryData(LEAGUE_KEYS.one('l1'), { id: 'l1', name: 'Lega del Bar', admin: true, members: [] });
    const { result } = renderHook(() => useLeagueName('l1'), { wrapper: wrapperWith(client) });
    expect(result.current).toBe('Lega del Bar');
  });

  it('ripiega sull elenco delle leghe', () => {
    const client = new QueryClient();
    client.setQueryData(LEAGUE_KEYS.all, [{ id: 'l1', name: 'Lega del Bar' }, { id: 'l2', name: 'Altra' }]);
    const { result } = renderHook(() => useLeagueName('l1'), { wrapper: wrapperWith(client) });
    expect(result.current).toBe('Lega del Bar');
  });

  // Serve al percorso nella barra: un'etichetta non vale una chiamata in piu'.
  it('senza niente in cache non sa il nome, e non lo chiede', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useLeagueName('l1'), { wrapper: wrapperWith(new QueryClient()) });
    expect(result.current).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Vederle fallire**

Run: `npm test -- src/AppShell.test.tsx src/api/useLeagueName.test.tsx`
Expected: FAIL. `AppShell`: due collegamenti invece di uno, nessuna navigazione «Percorso», nessun gruppo «Comandi della pagina». `useLeagueName`: non esportata.

- [ ] **Step 3: `useLeagueName`**

In `frontend/src/api/leagues.ts`, subito dopo `useLeague`:

```ts
/**
 * Il nome della lega se e' gia' noto — dalla sua pagina o dall'elenco — senza
 * chiederlo. Serve al percorso nella barra delle pagine che della lega non leggono
 * altro: un'etichetta non vale una chiamata in piu'. Chi arriva su una di quelle
 * pagine ricaricando non lo trova, e il percorso dice «Lega».
 */
export function useLeagueName(id: string): string | undefined {
  const client = useQueryClient();
  return client.getQueryData<LeagueDetail>(LEAGUE_KEYS.one(id))?.name
    ?? client.getQueryData<LeagueCard[]>(LEAGUE_KEYS.all)?.find((l) => l.id === id)?.name;
}
```

- [ ] **Step 4: `AppShell`**

Sostituire il contenuto di `frontend/src/AppShell.tsx` con:

```tsx
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMe } from './api/auth';
import { FOCUS_RING } from './domain/controls';
import { ProfileMenu } from './domain/ProfileMenu';
import { Wordmark } from './domain/Wordmark';

/** Un passo del percorso. L'ultimo dell'elenco e' la pagina in cui ci si trova. */
export interface TrailStep {
  label: string;
  /** Dove porta. Assente sull'ultimo passo, che non e' un collegamento. */
  to?: string;
}

/**
 * Le barre comuni a ogni schermata.
 *
 * <p><b>Due, non una.</b> Sopra la navigazione: marchio, percorso, stato, profilo.
 * Sotto, solo dove servono, i comandi della schermata ({@code slotActions}: all'asta
 * fase, proiezione, annulla, impostazioni). In una riga sola non c'era posto per
 * tutti, e sul telefono andavano a capo su tre righe.
 *
 * <p><b>Il percorso</b> ({@code trail}) dice dove si e' e come si torna indietro, un
 * passo alla volta: «Le mie leghe › Lega del Bar › Asta estiva». Sostituisce la voce
 * «Le mie leghe» e le frecce «Torna a…» che ogni pagina portava per conto suo. Sul
 * telefono resta il solo passo precedente, come freccia indietro.
 *
 * <p>Il fondo sta in {@code AppFrame}, la rotta che avvolge tutte le altre.
 *
 * <p><b>La proiezione resta senza chrome.</b> E' una seconda schermata pensata per
 * un proiettore: zero pulsanti, zero collegamenti. {@code chrome="none"} toglie
 * percorso, profilo e comandi, e lascia «FantaAgent» come semplice testo.
 */
export function AppShell({
  children,
  chrome,
  trail = [],
  slotStatus,
  slotActions,
  bleed = false,
}: {
  children: ReactNode;
  /** Senza margini attorno al contenuto: la pagina che va da bordo a bordo. */
  bleed?: boolean;
  /** "top": le barre con la navigazione. "none": la proiezione, senza navigazione. */
  chrome: 'top' | 'none';
  /** Il percorso fino a questa pagina. Reso solo con chrome="top". */
  trail?: TrailStep[];
  slotStatus?: ReactNode;
  /** I comandi della schermata, nella seconda barra. Resi solo con chrome="top". */
  slotActions?: ReactNode;
}) {
  // slotActions con chrome !== 'top' non va nascosto con CSS: non va reso affatto.
  // Un pulsante nascosto alla vista resta comunque raggiungibile da tastiera e dai
  // lettori di schermo, su una schermata che non lo prevede.
  const actions = chrome === 'top' ? slotActions : null;
  const location = useLocation();
  const me = useMe();

  return (
    <>
      {/* Ferme in cima, insieme, mentre la pagina scorre. z-30: sopra i pannelli e
          i menu che scorrono sotto. */}
      <div className="sticky top-0 z-30">
        <header
          role="banner"
          className="flex min-h-[var(--header-h)] items-center gap-4 border-b border-panel-border bg-bar px-4 text-sm"
        >
          {chrome === 'top' ? (
            <Link to="/" className={`flex min-h-11 shrink-0 items-center ${FOCUS_RING}`}>
              <Wordmark size="md" />
            </Link>
          ) : (
            // La proiezione: «FantaAgent» e' testo semplice, non un collegamento.
            <Wordmark size="md" />
          )}
          {chrome === 'top' && trail.length > 0 ? <Trail steps={trail} /> : null}
          <div className="ml-auto shrink-0">{slotStatus}</div>
          {chrome === 'top' && me.data ? (
            <ProfileMenu me={me.data} current={location.pathname === '/profilo'} />
          ) : null}
        </header>
        {actions ? (
          // Un gruppo e non una toolbar: role="toolbar" promette le frecce per
          // spostarsi fra i comandi, e qui ci si sposta con Tab come ovunque.
          <div
            role="group"
            aria-label="Comandi della pagina"
            className="flex min-h-14 flex-wrap items-center gap-2 border-b border-panel-border bg-background px-4 py-1.5 text-sm"
          >
            {actions}
          </div>
        ) : null}
      </div>
      <main role="main" className={`relative z-10 ${bleed ? '' : 'p-4 md:p-6'}`}>
        {children}
      </main>
    </>
  );
}

function Trail({ steps }: { steps: TrailStep[] }) {
  // Il passo da cui si viene: l'unico che resta sul telefono.
  const previous = steps.length - 2;
  return (
    <nav aria-label="Percorso" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1">
        {steps.map((step, i) => {
          const current = i === steps.length - 1;
          return (
            <li
              key={`${i}-${step.label}`}
              className={`flex min-w-0 items-center gap-1 ${i === previous ? '' : 'max-sm:hidden'}`}
            >
              {i > 0 ? <span aria-hidden="true" className="text-muted-foreground max-sm:hidden">›</span> : null}
              {current || !step.to ? (
                <span aria-current={current ? 'page' : undefined} className="truncate px-2 font-semibold">
                  {step.label}
                </span>
              ) : (
                <Link
                  to={step.to}
                  className={`flex min-h-11 min-w-0 items-center gap-1 rounded-lg px-2 text-muted-foreground hover:text-foreground ${FOCUS_RING}`}
                >
                  {/* Sul telefono, dove e' il solo passo in vista, dice di essere
                      la via del ritorno. Decorazione: il nome resta quello del passo. */}
                  <span aria-hidden="true" className="sm:hidden">‹</span>
                  <span className="truncate">{step.label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```

In `frontend/src/index.css` la regola di `--header-h` diventa (56px, la sola barra di navigazione):

```css
/* L'altezza della barra di navigazione (AppShell): 56px. Serve a chi deve sapere
   dove comincia il contenuto rispetto alla finestra. La barra dei comandi, dove
   c'e', e' della pagina che la chiede. */
:root {
  --header-h: 3.5rem;
}
```

- [ ] **Step 5: Ogni pagina dichiara il suo percorso**

`routes/LeaguesRoute.tsx` — l'unico `<AppShell chrome="top">`:

```tsx
    <AppShell chrome="top" trail={[{ label: 'Le mie leghe' }]}>
```

`routes/LeagueRoute.tsx` — dopo `const admin = …`:

```tsx
  const trail = [{ label: 'Le mie leghe', to: '/' }, { label: league.data?.name ?? 'Lega' }];
```

e `trail={trail}` su entrambi gli `<AppShell chrome="top">` (righe 31 e 55).

`routes/ProfileRoute.tsx`:

```tsx
    <AppShell chrome="top" trail={[{ label: 'Le mie leghe', to: '/' }, { label: 'Il tuo profilo' }]}>
```

`routes/ImportRoute.tsx` — prima del `return`:

```tsx
  const trail = [
    { label: 'Le mie leghe', to: '/' },
    { label: league.data?.name ?? 'Lega', to: `/leghe/${leagueId}` },
    { label: "Importa un'asta" },
  ];
```

`trail={trail}` sull'`<AppShell>`; togliere `<BackLink to={`/leghe/${leagueId}`} label="Torna alla lega" />` e l'import di `BackLink`. Il `<div className="flex items-center gap-4">` che lo conteneva resta, col solo `<h1>`.

`routes/LeagueRulesRoute.tsx` — aggiungere `useLeagueName` all'import da `'../api/leagues'` e, dopo `const save = …`:

```tsx
  const leagueName = useLeagueName(leagueId);
  const trail = [
    { label: 'Le mie leghe', to: '/' },
    { label: leagueName ?? 'Lega', to: `/leghe/${leagueId}` },
    { label: 'Regole' },
  ];
```

`trail={trail}` sui tre `<AppShell chrome="top">` (righe 172, 188, 323). Togliere il `<Link … aria-label="Torna alla lega">` con la sua freccia (righe 361–369) e il commento che lo precede; il `<div className="relative flex items-center justify-center">` resta col solo `<h1>`. Se `Link` non è più usato nel file, toglierlo dall'import: `tsc` lo segnala (`noUnusedLocals`).

`routes/AuctionSettingsRoute.tsx` — dopo `const card = …`:

```tsx
  const trail = [
    { label: 'Le mie leghe', to: '/' },
    { label: league.data?.name ?? 'Lega', to: `/leghe/${leagueId}` },
    { label: card?.name ?? 'Asta', to: `/leghe/${leagueId}/aste/${auctionId}` },
    { label: 'Impostazioni' },
  ];
```

`trail={trail}` sui tre `<AppShell chrome="top">` (righe 47, 58, 95). Togliere `<BackLink … label="Torna all'asta" />` e l'import. Poi:

```bash
git rm frontend/src/domain/BackLink.tsx
```

`routes/AuctionRoute.tsx` — aggiungere `import { useLeagueName } from '../api/leagues';` e, dopo `const state = useAuctionState();`:

```tsx
  const leagueName = useLeagueName(leagueId);
  const trail = [
    { label: 'Le mie leghe', to: '/' },
    { label: leagueName ?? 'Lega', to: `/leghe/${leagueId}` },
    { label: state.data?.auctionName ?? 'Asta' },
  ];
```

`trail={trail}` su entrambi gli `<AppShell chrome="top">` (righe 549 e 561).

- [ ] **Step 6: I comandi dell'asta, col nome scritto**

In `routes/AuctionRoute.tsx` la costante `ICON_LINK` diventa:

```tsx
// Bersaglio 44x44 garantito, condiviso dai due collegamenti della barra dei
// comandi. Da tablet in su portano il nome accanto all'icona: tre tondi uguali
// non dicevano quale fosse la proiezione e quale le impostazioni.
const ICON_LINK =
  'flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-control-border font-medium hover:bg-line md:px-4'
  + ' focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';
```

Dentro `slotActions`, la fase resta prima e gli altri tre comandi vanno in un gruppo spinto a destra. Il collegamento alla proiezione, `UndoLastButton` e il collegamento dell'ingranaggio diventano:

```tsx
          <span className="flex items-center gap-2 sm:ml-auto">
            <a
              href={`/leghe/${leagueId}/aste/${auctionId}/proiezione`}
              target="_blank"
              rel="noopener noreferrer"
              className={ICON_LINK}
            >
              <ProjectionIcon />
              {/* Lo spazio sta fra i due span, nello stesso sottoalbero di entrambi:
                  messo in testa al secondo, il calcolo del nome accessibile lo
                  rifila e le due parti si saldano. */}
              <span>
                <span className="max-md:sr-only">Apri la proiezione</span>
                {' '}
                <span className="sr-only">sul secondo schermo</span>
              </span>
            </a>
            {admin ? (
              <UndoLastButton
                canUndo={state.data?.canUndo ?? false}
                onUndo={undo}
                pending={undoLast.isPending}
              />
            ) : null}
            <Link to={gear.to} className={ICON_LINK}>
              <SettingsIcon />
              <span className="max-md:sr-only">{gear.label}</span>
            </Link>
          </span>
```

I commenti che oggi precedono il collegamento alla proiezione e quello dell'ingranaggio restano sopra i rispettivi elementi. I nomi accessibili non cambiano («Apri la proiezione sul secondo schermo», «Impostazioni dell'asta» o «Vai alla lega»): le prove che li cercano restano valide.

- [ ] **Step 7: La prova della freccia delle regole**

In `frontend/src/routes/LeagueRulesRoute.test.tsx` la prova «la freccia riporta alla pagina della lega» diventa:

```tsx
  it('il percorso riporta alla pagina della lega', async () => {
    stubRules(RULES);
    renderRules();
    const trail = await screen.findByRole('navigation', { name: 'Percorso' });
    expect(within(trail).getByRole('link', { name: 'Lega' })).toHaveAttribute('href', '/leghe/l1');
  });
```

Aggiungere `within` all'import da `@testing-library/react` se manca.

- [ ] **Step 8: Vedere le prove passare**

Run: `npm test -- src/AppShell.test.tsx src/api/useLeagueName.test.tsx src/routes/LeagueRulesRoute.test.tsx`
Expected: PASS.

Run: `npm test && npm run build && npm run lint`
Expected: PASS tutti e tre. Una prova che cerca per nome un collegamento ora presente anche nel percorso (per esempio il nome della lega) trova due elementi: restringerla con `within(screen.getByRole('main'))`.

- [ ] **Step 9: Commit**

```bash
git add -A frontend/src
git commit -m "Due barre: la navigazione col percorso sopra, i comandi della schermata sotto

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: L'oro fuori dalle iniziali, e i nomi interi in proiezione

**Files:**
- Modify: `frontend/src/routes/LeagueRoute.tsx` (l'iniziale del membro), `frontend/src/routes/LeagueRoute.test.tsx`
- Modify: `frontend/src/routes/ProjectionRoute.tsx` (`BoardTeam`), `frontend/src/routes/ProjectionRoute.test.tsx`

**Interfaces:**
- Consumes: `border-panel-border`, `bg-surface-raised` (Task 2).

- [ ] **Step 1: Le prove**

In `frontend/src/routes/LeagueRoute.test.tsx`, dopo «mostra i membri con la loro squadra»:

```tsx
  // L'oro e' dell'azione principale e del numero su cui si decide. Otto tondi
  // d'oro in un elenco di membri gli toglievano forza senza dire niente.
  it('le iniziali dei membri non portano l oro', async () => {
    stub(false);
    renderLeague();
    const members = await screen.findByRole('list', { name: 'Membri' });
    await within(members).findByText('Bruno FC');
    const initials = members.querySelectorAll('li > span[aria-hidden="true"]');
    expect(initials).toHaveLength(2);
    initials.forEach((initial) => expect(initial.className).not.toContain('bg-accent'));
  });
```

In `frontend/src/routes/ProjectionRoute.test.tsx`, dentro `describe('ProjectionRoute', …)`:

```tsx
  /**
   * Sul proiettore il nome di una squadra e' cio' che la sala cerca per primo:
   * troncato a «Real…» e «Atle…» non lo trova nessuno. Va su due righe, e ogni
   * intestazione tiene il posto di due, cosi' le righe sotto restano allineate da
   * una squadra all'altra.
   */
  it('il nome della squadra va su due righe invece di troncarsi', async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    stubFetch();
    renderProjection();
    const name = await screen.findByRole('heading', { name: 'Anna', level: 3 });
    expect(name.className).not.toContain('truncate');
    expect(name.className).toContain('line-clamp-2');
    expect(name.className).toContain('min-h-[2.1em]');
  });
```

- [ ] **Step 2: Vederle fallire**

Run: `npm test -- src/routes/LeagueRoute.test.tsx src/routes/ProjectionRoute.test.tsx`
Expected: FAIL. Le iniziali hanno `bg-accent`; il nome ha `truncate`.

- [ ] **Step 3: L'iniziale senza oro**

In `frontend/src/routes/LeagueRoute.tsx`, dentro `MembersPanel`:

```tsx
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full border border-panel-border bg-surface-raised font-semibold">
              {m.initial}
            </span>
```

- [ ] **Step 4: Il nome su due righe**

In `frontend/src/routes/ProjectionRoute.tsx`, dentro `BoardTeam`, l'intestazione diventa:

```tsx
      {/* items-start: col nome su due righe, i crediti restano in cima invece di
          scendere sulla seconda. */}
      <header className="flex shrink-0 items-start justify-between gap-2 border-b border-line-strong pb-2">
        {/* Due righe al massimo, e sempre il posto di due (2,1em a interlinea 1,05):
            un nome corto non accorcia la sua intestazione, e le righe dei
            giocatori restano allineate da una squadra all'altra. */}
        <h3
          id={headingId}
          className="w-exp line-clamp-2 min-h-[2.1em] break-words text-[clamp(1rem,2.4vh,2rem)] font-extrabold leading-[1.05]"
        >
          {c.participantName}
        </h3>
```

Il `<p>` dei crediti subito sotto resta com'è.

- [ ] **Step 5: Vedere le prove passare**

Run: `npm test -- src/routes/LeagueRoute.test.tsx src/routes/ProjectionRoute.test.tsx src/styles/weights.test.ts`
Expected: PASS (il conto dei `font-extrabold` di `ProjectionRoute.tsx` resta tre).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/routes/LeagueRoute.tsx frontend/src/routes/LeagueRoute.test.tsx frontend/src/routes/ProjectionRoute.tsx frontend/src/routes/ProjectionRoute.test.tsx
git commit -m "Le iniziali dei membri senza oro; in proiezione il nome della squadra su due righe

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Guardare ogni pagina, e annotare

Le prove sono verdi, ma nessuna dice se una pagina è diventata peggiore di prima. Questo task non scrive codice dell'app: guarda, e lascia scritto cosa ha visto per i piani successivi.

**Files:**
- Create: `docs/superpowers/decisions/2026-09-30-club-notturno-fondamenta.md`

**Interfaces:**
- Consumes: `npm run screens` (Task 1); le immagini di partenza in `frontend/test-results/screens/prima`.

- [ ] **Step 1: La suite intera**

```bash
cd frontend
npm test && npm run build && npm run lint
```

Expected: PASS tutti e tre.

- [ ] **Step 2: Fotografare il dopo**

```bash
npm run dev                                   # in un altro terminale
npm run screens -- test-results/screens/dopo
```

Expected: 40 righe `ok …`, `non gestite: []`. L'elenco `larghe:` non deve contenere pagine che non c'erano in quello di partenza.

- [ ] **Step 3: Confrontare, una pagina alla volta**

Aprire ogni coppia `prima/<nome>.png` e `dopo/<nome>.png`, a 1440px e a 390px. Per ognuna rispondere a quattro domande:

1. C'è erba o una riga in gesso fuori dalle pagine d'ingresso? (Non deve.)
2. Un testo è illeggibile, o un bordo di bottone o di campo non si vede?
3. C'è un vuoto grande che prima l'erba mascherava? (Profilo e importazione sono i candidati: due pannelli corti in mezzo alla finestra.)
4. Il percorso nella barra è giusto, e sul telefono resta una freccia indietro sola?

Un difetto delle domande 1 e 2 si corregge in questo task, con la sua prova, e si rifotografa. Un difetto della domanda 3 non si corregge: si annota.

- [ ] **Step 4: Scrivere le note**

Creare `docs/superpowers/decisions/2026-09-30-club-notturno-fondamenta.md` con questa forma, riempita con ciò che si è visto davvero (una riga per ognuna delle 20 schermate; «niente da segnalare» dove è così):

```markdown
# Club Notturno, fondamenta — cosa si è visto

Piano: [2026-09-30-club-notturno-fondamenta.md](../plans/2026-09-30-club-notturno-fondamenta.md) ·
Spec: [2026-09-30-club-notturno-fondamenta-asta-design.md](../specs/2026-09-30-club-notturno-fondamenta-asta-design.md)

Confronto fatto con `npm run screens`, a 1440×900 e 390×844, prima e dopo.

## Pagina per pagina

| Schermata | Computer | Telefono | A quale passo tocca |
|---|---|---|---|
| 01 Accedi | | | 4 — ingresso |
| 02 Registrati | | | 4 — ingresso |
| 03 Password dimenticata | | | 4 — ingresso |
| 04 Nuova password | | | 4 — ingresso |
| 05 Verifica email | | | 4 — ingresso |
| 06 Invito | | | 4 — ingresso |
| 07 Errore | | | 4 — ingresso |
| 08 Le mie leghe | | | 3 — gestione |
| 08b Le mie leghe, ricerca | | | 3 — gestione |
| 09 Lega | | | 3 — gestione |
| 10 Regole della lega | | | 3 — gestione |
| 11 Importa un'asta | | | 3 — gestione |
| 12 Profilo | | | 3 — gestione |
| 13 Asta a riposo | | | 2 — asta |
| 14 Asta, giocatore sul banco | | | 2 — asta |
| 14b Asta, conto avviato | | | 2 — asta |
| 14d Asta, tempo scaduto | | | 2 — asta |
| 14c Asta, rose | | | 2 — asta |
| 15 Impostazioni dell'asta | | | 3 — gestione |
| 16 Proiezione | | | 2 — asta |

## Il banco, misurato

Altezza del contenuto del banco a 1440×900 con otto squadre, dopo le fondamenta
(dagli screenshot 14, 14b, 14d): lotto … px, conto … px, tempo scaduto … px. Il piano
dell'asta parte da questi numeri, non dai 380px stimati nella specifica.

## Corretto in questo passo

## Rimandato
```

I tre numeri del banco si misurano aprendo l'asta nel browser, in ognuno dei tre stati, ed eseguendo nella console:

```js
document.querySelector('[data-testid=auction-row]').children[1].querySelector('section .overflow-y-auto').firstElementChild.getBoundingClientRect().height
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/decisions/2026-09-30-club-notturno-fondamenta.md
git commit -m "Club Notturno, fondamenta: cosa si è visto pagina per pagina, e il banco misurato

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Dopo questo piano

Due piani restano da scrivere sulla stessa specifica, in quest'ordine, ognuno a partire dalle note del Task 8:

1. **L'asta sul computer** (spec §4): la griglia alta quanto la finestra, il banco a misura fissa, il conto con l'offerta come numero eroe, la tabella dentro il primo schermo, la colonna dei consigli con «La tua rosa».
2. **L'asta sul telefono** (spec §5): le quattro viste con la barra in basso e il menu «Comandi».
