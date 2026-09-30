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
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log('ok', name);
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
console.log('traboccano:', spilling);
console.log('scorrono:', scrolling);
