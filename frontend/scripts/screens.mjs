// Fotografa ogni pagina senza backend: Vite gia' avviato, risposte finte.
//
//   npm run dev                       (in un altro terminale)
//   npm run screens -- test-results/screens/prima
//
// Il filtro delle chiamate guarda il percorso, non '**/api/**': quello prenderebbe
// anche i moduli che Vite serve da /src/api/, e la pagina resterebbe bianca.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, webkit } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = resolve(process.argv[2] ?? 'test-results/screens');
mkdirSync(OUT, { recursive: true });

const ROLES = ['P', 'D', 'C', 'A'];
const SLOTS = { P: 3, D: 8, C: 8, A: 6 };
// Quante squadre al tavolo: otto di solito, altre con TEAMS_COUNT (una lega ne ha
// almeno due e nessun massimo). Le prime otto restano quelle di sempre, cosi' le
// fotografie di default non cambiano; oltre la lista si numerano.
const TEAMS_COUNT = Math.max(2, Number(process.env.TEAMS_COUNT ?? 8));
const ALL_TEAMS = ['Real Colizzati', 'Atletico Ma Non Troppo', 'Borussia Porcmund', 'Longobarda',
  'AC Picchia', 'Dinamo Spritz', 'Scarsenal', 'Patetico Madrid', 'Inter Nazionale', 'Rapid Mente',
  'Olympique Marsiglia Nera', 'Bayern Monaco di Baviera'];
const ALL_PEOPLE = ['Luigi', 'Diego', 'Marta', 'Paolo', 'Sara', 'Andrea', 'Giulia', 'Tommaso', 'Chiara', 'Luca',
  'Elena', 'Stefano'];
const TEAMS = Array.from({ length: TEAMS_COUNT }, (_, i) => ALL_TEAMS[i] ?? `Squadra ${i + 1}`);
const PEOPLE = Array.from({ length: TEAMS_COUNT }, (_, i) => ALL_PEOPLE[i] ?? `Giocatore ${i + 1}`);
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

// Con piu' di otto squadre i nomi finiscono prima dei posti da riempire: se ne
// aggiungono di numerati, perche' nessun giocatore finisca in due rose.
const SOLD = { P: 3, D: 8, C: 4 };
for (const r of ROLES) {
  const needed = (SOLD[r] ?? 0) * TEAMS.length + 30;
  for (let i = NAMES[r].length; TEAMS.length > 8 && i < needed; i++) NAMES[r].push(`${NAMES[r][i % 20]} ${Math.floor(i / 20) + 1}`);
}

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
  take('C', [3, 2, 4, 1, 3, 2, 2, 3][t % 8]);
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
    purchases: seq, phase: 'C', teams: TEAMS.length, budget: 500, totalSlots: 25 * TEAMS.length,
    myBudgetRemaining: participants[0].budgetRemaining, bidder },
  { id: 'A2', name: 'Asta di riparazione', createdAt: '2026-01-10T18:00:00Z', lastWritten: '2026-01-12T22:00:00Z',
    purchases: 24, phase: 'A', teams: TEAMS.length, budget: 150, totalSlots: 24, myBudgetRemaining: 12, bidder },
];
const leagues = [
  { id: 'L1', name: 'Lega dei Colizzati', admin: true, teamName: 'Real Colizzati', initial: 'R', members: TEAMS.length, auctions: 2, pendingRequests: 2 },
  { id: 'L2', name: 'Fantaufficio', admin: false, teamName: 'Scarsenal', initial: 'S', members: 10, auctions: 1, pendingRequests: 0 },
  { id: 'L3', name: 'Calcetto del giovedì', admin: false, teamName: 'Dinamo Spritz', initial: 'D', members: 6, auctions: 2, pendingRequests: 0 },
];
// Le aste di tutte le leghe, per la home: due in corso, una da iniziare, quattro
// concluse (piu' delle tre che si vedono prima di «Mostra tutte»).
const myAuctions = [
  { id: 'A1', leagueId: 'L1', leagueName: 'Lega dei Colizzati', name: 'Asta estiva 2026', status: 'IN_PROGRESS',
    phase: 'C', budgetRemaining: participants[0].budgetRemaining, slotsRemaining: participants[0].slotsRemaining,
    lastActivity: '2026-09-28T21:10:00Z', admin: true },
  { id: 'A5', leagueId: 'L3', leagueName: 'Calcetto del giovedì', name: 'Asta del giovedì', status: 'IN_PROGRESS',
    phase: 'D', budgetRemaining: 214, slotsRemaining: 17, lastActivity: '2026-09-26T22:40:00Z', admin: false },
  { id: 'A6', leagueId: 'L2', leagueName: 'Fantaufficio', name: 'Asta di settembre', status: 'NOT_STARTED',
    phase: 'P', budgetRemaining: 500, slotsRemaining: 25, lastActivity: '2026-09-20T09:00:00Z', admin: false },
  { id: 'A2', leagueId: 'L1', leagueName: 'Lega dei Colizzati', name: 'Asta di riparazione', status: 'CONCLUDED',
    phase: 'A', budgetRemaining: 12, slotsRemaining: 0, lastActivity: '2026-01-12T22:00:00Z', admin: true },
  { id: 'A7', leagueId: 'L3', leagueName: 'Calcetto del giovedì', name: 'Asta estiva 2025', status: 'CONCLUDED',
    phase: 'A', budgetRemaining: 3, slotsRemaining: 0, lastActivity: '2025-09-14T23:00:00Z', admin: false },
  { id: 'A8', leagueId: 'L2', leagueName: 'Fantaufficio', name: 'Asta 2025', status: 'CONCLUDED',
    phase: 'A', budgetRemaining: 0, slotsRemaining: 0, lastActivity: '2025-09-02T22:30:00Z', admin: false },
  { id: 'A9', leagueId: 'L1', leagueName: 'Lega dei Colizzati', name: 'Asta estiva 2025', status: 'CONCLUDED',
    phase: 'A', budgetRemaining: 7, slotsRemaining: 0, lastActivity: '2025-08-30T23:30:00Z', admin: true },
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
  if (path === '/api/auctions') return J(myAuctions);
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

// Le misure delle finestre: quelle di sempre, o quelle chieste con SIZES.
const SIZES = (process.env.SIZES ?? '1440x900,390x844').split(',').map((s) => {
  const [width, height] = s.split('x').map(Number);
  const tag = s === '1440x900' ? 'desktop' : s === '390x844' ? 'telefono' : s;
  return { viewport: { width, height }, tag };
});

const browser = await chromium.launch();
const wide = [];
const spilling = [];
const scrolling = [];
const belowFold = [];
const splitWords = [];
const confirmStuck = [];

// I nomi che sul telefono vanno a capo — il lotto nella testata del banco, le
// squadre a tempo scaduto — devono andarci fra le parole: una parola tagliata a
// meta' («Porc-mund») non si legge. Lo si misura lettera per lettera: due lettere
// della stessa parola su righe diverse sono una parola spezzata. Dopo un trattino
// del nome («Milinkovic-Savic») andare a capo e' lecito.
async function probeNames(page, label) {
  const found = await page.evaluate(() => {
    const els = [document.querySelector('[data-testid=banco-header] h2'),
      ...document.querySelectorAll('fieldset button span[lang=it]')].filter(Boolean);
    return els.map((el) => {
      const text = el.firstChild;
      if (!text || text.nodeType !== Node.TEXT_NODE) return null;
      const chars = [...text.textContent];
      const tops = chars.map((_, i) => {
        const r = document.createRange();
        r.setStart(text, i);
        r.setEnd(text, i + 1);
        return Math.round(r.getBoundingClientRect().top);
      });
      let split = false;
      for (let i = 1; i < tops.length; i++) {
        if (tops[i] !== tops[i - 1] && !/[\s-]/.test(chars[i - 1]) && !/\s/.test(chars[i])) split = true;
      }
      return { text: text.textContent, lines: new Set(tops).size, split };
    }).filter(Boolean);
  });
  const broken = found.filter((f) => f.split).map((f) => f.text);
  const wrapped = found.filter((f) => f.lines > 1).map((f) => `${f.text} (${f.lines})`);
  console.log(`   nomi: ${found.length}, su piu' righe ${wrapped.join(', ') || 'nessuno'}${broken.length ? `, SPEZZATI ${broken.join(', ')}` : ''}`);
  for (const b of broken) splitWords.push(`${label}: ${b}`);
}

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
  // Sul computer il banco ha un'altezza fissa: il suo contenuto non deve scorrere
  // e la pagina dell'asta non deve scorrere in verticale.
  if (/^1[34]/.test(name) && page.viewportSize().width >= 1024) {
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
  }
  // Sul telefono il banco deve stare tutto nella prima schermata, sopra la barra
  // delle viste: chi batte non deve scorrere per trovare il bottone. La
  // fotografia resta a pagina intera; la prima schermata ne sono i primi pixel
  // alti quanto la finestra.
  if (/^1(3-|4-|4b-|4d-|4e-)/.test(name) && page.viewportSize().width < 1024) {
    const fold = await page.evaluate(() => {
      const banco = document.querySelector('[data-testid=banco]');
      const bar = document.querySelector('[role=tablist][aria-label="Viste dell\'asta"]');
      if (!banco || !bar) return null;
      return {
        bottom: Math.round(banco.getBoundingClientRect().bottom),
        barTop: Math.round(bar.parentElement.getBoundingClientRect().top),
      };
    });
    if (fold) {
      const gap = fold.barTop - fold.bottom;
      console.log(`   banco fino a ${fold.bottom}px, barra da ${fold.barTop}px (${gap >= 0 ? 'margine' : 'manca'} ${Math.abs(gap)}px)`);
      if (gap < 0) belowFold.push(`${name} (-${-gap}px)`);
    }
  }
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log('ok', name);
}

// Sul telefono le sezioni dell'asta sono quattro viste, scelte dalla barra in basso.
async function phoneView(page, name) {
  await page.getByRole('tablist', { name: "Viste dell'asta" }).getByRole('tab', { name }).click();
  await page.waitForTimeout(600);
}

for (const { viewport: vp, tag } of SIZES) {
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
  await shot(user.page, `08c-crea-lega-${tag}`, null, async (p) => {
    await p.getByRole('button', { name: 'Crea una lega' }).first().click();
  });
  await user.page.keyboard.press('Escape');
  await shot(user.page, `08d-unisciti-${tag}`, null, async (p) => {
    await p.getByRole('button', { name: 'Unisciti a una lega' }).first().click();
    await p.getByLabel('Cerca la lega').fill('bar');
    await p.waitForTimeout(600);
  });
  await user.page.keyboard.press('Escape');
  await shot(user.page, `09-lega-${tag}`, '/leghe/L1');
  await shot(user.page, `10-regole-lega-${tag}`, '/leghe/L1/regole');
  await shot(user.page, `11-importa-${tag}`, '/leghe/L1/importa');
  await shot(user.page, `12-profilo-${tag}`, '/profilo');
  await shot(user.page, `15-impostazioni-asta-${tag}`, '/leghe/L1/aste/A1/impostazioni');
  await shot(user.page, `16-proiezione-${tag}`, '/leghe/L1/aste/A1/proiezione');
  const phone = vp.width < 1024;
  await shot(user.page, `13-asta-riposo-${tag}`, '/leghe/L1/aste/A1');
  if (phone) {
    await shot(user.page, `13g-asta-giocatori-${tag}`, null, (p) => phoneView(p, 'Giocatori'));
    await shot(user.page, `13s-asta-squadre-${tag}`, null, (p) => phoneView(p, 'Squadre'));
    await shot(user.page, `13r-asta-rose-${tag}`, null, (p) => phoneView(p, 'Rose'));
    await phoneView(user.page, 'Banco');
  }
  await shot(user.page, `14-asta-giocatore-${tag}`, null, async (p) => {
    if (phone) {
      // Sul telefono il giocatore si sceglie dalla vista Giocatori, e la scelta
      // riporta al Banco.
      await phoneView(p, 'Giocatori');
      await p.getByText(freeC[0].name, { exact: true }).filter({ visible: true }).first().click();
      const banco = p.getByRole('tablist', { name: "Viste dell'asta" }).getByRole('tab', { name: 'Banco' });
      if ((await banco.getAttribute('aria-selected')) !== 'true') console.log('   la scelta non ha riportato al Banco');
    } else {
      await p.getByText(freeC[0].name, { exact: true }).first().click();
    }
    await p.waitForTimeout(600);
  });
  await shot(user.page, `14b-asta-conto-${tag}`, null, async (p) => {
    await p.getByRole('button', { name: 'Avvia il conto alla rovescia' }).click();
    await p.waitForTimeout(1200);
  });
  if (phone) {
    // «Togli dal banco» col conto aperto chiede conferma: la richiesta e' la
    // scritta piu' lunga della testata, e sul telefono stretto non deve
    // spezzare il nome del lotto ne' far scorrere la pagina di lato.
    await shot(user.page, `14e-asta-togli-${tag}`, null, async (p) => {
      await p.getByRole('button', { name: 'Togli dal banco' }).click();
      await p.waitForTimeout(200);
      await probeNames(p, `14e-asta-togli-${tag}`);
      const over = await p.evaluate(() => {
        const header = document.querySelector('[data-testid=banco-header]');
        return header.scrollWidth - header.clientWidth;
      });
      if (over > 0) console.log(`   la testata del banco trabocca di ${over}px`);
    });
    // Fuori fuoco la richiesta torna «Togli dal banco», e il conto prosegue.
    await user.page.evaluate(() => document.activeElement?.blur());
  }
  await shot(user.page, `14d-asta-scaduto-${tag}`, null, async (p) => {
    await p.waitForTimeout(6000);
    if (phone) await probeNames(p, `14d-asta-scaduto-${tag}`);
  });
  await shot(user.page, `14c-asta-rose-${tag}`, '/leghe/L1/aste/A1', async (p) => {
    if (phone) await phoneView(p, 'Rose');
    else await p.getByRole('tab', { name: 'Rose squadre' }).click();
    await p.waitForTimeout(600);
  });
  await user.context.close();
}
await browser.close();

// Safari, l'unico motore dei telefoni Apple, va a capo e sillaba a modo suo: per
// esempio non conosce hyphenate-limit-chars. Il lotto col conto in conferma e il
// tempo scaduto si rifanno in WebKit, alle misure del telefono (WEBKIT=0 per
// saltarli, WEBKIT_SIZES per altre misure).
if (process.env.WEBKIT !== '0') {
  const engine = await webkit.launch();
  for (const s of (process.env.WEBKIT_SIZES ?? '390x844,360x740').split(',')) {
    const [width, height] = s.split('x').map(Number);
    const context = await engine.newContext({ viewport: { width, height }, deviceScaleFactor: 1, locale: 'it-IT' });
    await context.addCookies([{ name: 'XSRF-TOKEN', value: 'x', url: BASE }]);
    const page = await context.newPage();
    page.on('pageerror', (e) => console.log('errore nella pagina:', e.message));
    await page.route((url) => url.pathname.startsWith('/api/'), (route) => {
      const url = new URL(route.request().url());
      const r = respond(route.request().method(), url.pathname, url.searchParams, true);
      return route.fulfill({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.body) });
    });
    const tag = `webkit-${s}`;
    await page.goto(BASE + '/leghe/L1/aste/A1', { waitUntil: 'networkidle' });
    await phoneView(page, 'Giocatori');
    await page.getByText(freeC[0].name, { exact: true }).filter({ visible: true }).first().click();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Avvia il conto alla rovescia' }).click();
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: 'Togli dal banco' }).click();
    await page.waitForTimeout(200);
    await page.evaluate(() => window.scrollTo(0, 0));
    await probeNames(page, `14e-asta-togli-${tag}`);
    await page.screenshot({ path: `${OUT}/14e-asta-togli-${tag}.png`, fullPage: true });
    console.log('ok', `14e-asta-togli-${tag}`);
    // In Safari un bottone toccato non prende il fuoco: la conferma non puo'
    // contare sull'uscita dal bottone per tornare a riposo. Ci torna da sola in
    // quattro secondi (un rilancio tiene vivo il conto nel frattempo) e quando
    // il tempo scade.
    const confirmShown = () => page.getByRole('button', { name: 'Conferma: il lotto si perde' }).isVisible();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: /Rilancia \+1/ }).click();
    await page.waitForTimeout(2800);
    const afterTimeout = await confirmShown();
    const stillRunning = await page.getByRole('button', { name: /^Aggiudica a/ }).count() === 0;
    console.log(`   conferma dopo 4s: ${afterTimeout ? 'ANCORA ARMATA' : 'a riposo'}${stillRunning ? ', conto ancora aperto' : ''}`);
    if (afterTimeout) confirmStuck.push(`${tag}: dopo 4s`);
    // Riarmata a ~5,4s, il tempo scade a ~7,5s: si guarda a ~8,4s, prima che
    // scattino i quattro secondi.
    await page.getByRole('button', { name: 'Togli dal banco' }).click();
    await page.waitForTimeout(3000);
    const afterExpiry = await confirmShown();
    const expired = await page.getByRole('button', { name: /^Aggiudica a/ }).count() > 0;
    console.log(`   conferma allo scadere: ${afterExpiry ? 'ANCORA ARMATA' : 'a riposo'}${expired ? ', tempo scaduto' : ', tempo NON scaduto'}`);
    if (afterExpiry || !expired) confirmStuck.push(`${tag}: allo scadere`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await probeNames(page, `14d-asta-scaduto-${tag}`);
    const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (extra > 0) wide.push(`14d-asta-scaduto-${tag} (+${extra}px)`);
    await page.screenshot({ path: `${OUT}/14d-asta-scaduto-${tag}.png`, fullPage: true });
    console.log('ok', `14d-asta-scaduto-${tag}`);
    await context.close();
  }
  await engine.close();
}
console.log('larghe:', wide);
console.log('non gestite:', [...unknown]);
console.log('traboccano:', spilling);
console.log('scorrono:', scrolling);
console.log('banco sotto la piega:', belowFold);
console.log('parole spezzate:', splitWords);
console.log('conferma rimasta armata (WebKit):', confirmStuck);
