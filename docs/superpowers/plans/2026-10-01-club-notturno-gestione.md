# Club Notturno: le pagine di gestione — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Riprogettare le sei pagine di gestione (home, lega, regole, impostazioni dell'asta, profilo, importazione) sugli schemi comuni della specifica, con la home centrata sulle aste grazie a un endpoint nuovo `GET /api/auctions`.

**Architecture:** Un endpoint Java che elenca le aste dell'utente in tutte le sue leghe (riusa `LeagueAuctionService` e `LogSummary`). Nel frontend quattro primitive condivise (`PageHeader`, `Modal`, `SaveBar`, `SettingsLayout`) in `frontend/src/domain/`, poi una pagina per task, ognuna riscritta su quelle primitive senza cambiare indirizzi né chiamate esistenti.

**Tech Stack:** Spring Boot + JUnit/MockMvc (backend), React 19 + TypeScript + Tailwind v4 + TanStack Query + React Router 7, vitest + Testing Library, Playwright (`npm run screens`).

**Spec:** `docs/superpowers/specs/2026-10-01-club-notturno-gestione-design.md`

## Global Constraints

- Una sola azione oro (`BUTTON_PRIMARY`, `bg-accent`) per schermata; nell'intestazione di pagina mai oro.
- Nessun grande vuoto: si giudica la pagina intera a 1440×900, 390×844, 360×740.
- Riquadri di misura decisa in anticipo: niente che cambi altezza al cambio di stato (finestre, passaggi dell'importazione, barra di salvataggio).
- Ordine del documento = ordine visivo (niente `order-*`).
- Bersagli ≥ 44px (`min-h-11`); campi `FIELD` (48px).
- Un solo `role="alert"` per schermata; `AuctionAnnouncer` resta l'unica live region ambientale (qui non c'è).
- Testi per chi usa l'app: niente file, server, codice, API; «banditore», mai «battitore».
- Nessuna pagina scorre di lato; nessun nome spezzato a metà parola.
- Indirizzi invariati: `/`, `/leghe/:leagueId`, `/leghe/:leagueId/regole`, `/leghe/:leagueId/importa`, `/leghe/:leagueId/aste/:auctionId/impostazioni`, `/profilo`.
- Le pagine dell'asta e della proiezione non cambiano: i loro screenshot restano identici.
- Test di sorgente esistenti (`contrast.test.ts`, `weights.test.ts`, `shapes.test.ts`, `sizes.test.ts`) verdi: niente `text-xs`, niente `rounded-xl` e oltre, un solo `font-extrabold` per schermata.
- Ogni commit compila e passa `npm test`, `npm run build`, `npm run lint` (frontend) e `mvn -q test` per i task che toccano Java.
- Messaggi di commit in italiano, chiusi da `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Structure

Backend:
- Create `src/main/java/com/fantaagent/application/service/auction/AuctionStatus.java` — lo stato di un'asta dai suoi numeri.
- Create `src/main/java/com/fantaagent/application/service/auction/MyAuction.java` — una riga di «le mie aste».
- Modify `src/main/java/com/fantaagent/application/service/auction/LeagueAuctionService.java` — `mine(List<LeagueAccess>)`.
- Create `src/main/java/com/fantaagent/adapter/in/api/MyAuctionsApi.java` — `GET /api/auctions`.
- Tests: `src/test/java/com/fantaagent/application/service/auction/AuctionStatusTest.java`, `src/test/java/com/fantaagent/adapter/in/api/MyAuctionsApiTest.java`.

Frontend (`frontend/src/`):
- Modify `api/types.ts`, `api/leagues.ts` — `MyAuction`, `useMyAuctions`, invalidazioni.
- Create `domain/PageHeader.tsx`, `domain/Modal.tsx`, `domain/SaveBar.tsx`, `domain/SettingsLayout.tsx` (+ test).
- Create `domain/MyAuctionCard.tsx`, `domain/CreateLeagueDialog.tsx`, `domain/JoinLeagueDialog.tsx` (+ test).
- Create `domain/MemberMenu.tsx` (+ test), `domain/FolderPicker.tsx` (+ test).
- Modify `routes/LeaguesRoute.tsx`, `routes/LeagueRoute.tsx`, `routes/LeagueRulesRoute.tsx`, `routes/AuctionSettingsRoute.tsx`, `routes/ProfileRoute.tsx`, `routes/ImportRoute.tsx` e i loro test.
- Modify `scripts/screens.mjs` — mock di `/api/auctions`, schermate delle finestre.
- Modify `docs/superpowers/decisions/2026-09-30-club-notturno-fondamenta.md` — sezione «Le pagine di gestione — misure finali».

---

### Task 1: L'endpoint «le mie aste»

**Files:**
- Create: `src/main/java/com/fantaagent/application/service/auction/AuctionStatus.java`
- Create: `src/main/java/com/fantaagent/application/service/auction/MyAuction.java`
- Modify: `src/main/java/com/fantaagent/application/service/auction/LeagueAuctionService.java` (dopo `list`, riga ~105)
- Create: `src/main/java/com/fantaagent/adapter/in/api/MyAuctionsApi.java`
- Test: `src/test/java/com/fantaagent/application/service/auction/AuctionStatusTest.java`
- Test: `src/test/java/com/fantaagent/adapter/in/api/MyAuctionsApiTest.java`

**Interfaces:**
- Produces: `GET /api/auctions` → JSON array of `{ id, leagueId, leagueName, name, status: "NOT_STARTED"|"IN_PROGRESS"|"CONCLUDED", phase: "P"|"D"|"C"|"A", budgetRemaining: number, slotsRemaining: number, lastActivity: ISO string, admin: boolean }`, ordered by `lastActivity` descending.

- [ ] **Step 1: Write the failing status test**

```java
package com.fantaagent.application.service.auction;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AuctionStatusTest {

    @Test
    void senzaAcquistiEDaIniziare() {
        assertThat(AuctionStatus.of(0, 75)).isEqualTo(AuctionStatus.NOT_STARTED);
    }

    @Test
    void conQualcheAcquistoEInCorso() {
        assertThat(AuctionStatus.of(1, 75)).isEqualTo(AuctionStatus.IN_PROGRESS);
    }

    /** La stessa regola della schermata dell'asta: tutti i posti di tutte le squadre pieni. */
    @Test
    void coiPostiPieniEConclusa() {
        assertThat(AuctionStatus.of(75, 75)).isEqualTo(AuctionStatus.CONCLUDED);
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `mvn -q test -Dtest=AuctionStatusTest`
Expected: compilation FAIL, `AuctionStatus` not found.

- [ ] **Step 3: Implement `AuctionStatus` and `MyAuction`**

```java
package com.fantaagent.application.service.auction;

/**
 * A che punto e' un'asta, dai suoi numeri. Conclusa con la stessa regola della
 * schermata dell'asta: tutti i posti di tutte le squadre pieni.
 */
public enum AuctionStatus {
    NOT_STARTED, IN_PROGRESS, CONCLUDED;

    public static AuctionStatus of(int purchases, int totalSlots) {
        if (purchases == 0) return NOT_STARTED;
        return purchases >= totalSlots ? CONCLUDED : IN_PROGRESS;
    }
}
```

```java
package com.fantaagent.application.service.auction;

import com.fantaagent.domain.player.Role;

import java.time.Instant;
import java.util.UUID;

/**
 * Un'asta in cui l'utente ha un posto, vista dalla home: quanto basta per
 * riconoscerla e decidere se entrarci. {@code lastActivity} e' l'ultimo evento
 * scritto, o la creazione per un'asta ancora senza acquisti.
 */
public record MyAuction(UUID id, UUID leagueId, String leagueName, String name, AuctionStatus status,
                        Role phase, int budgetRemaining, int slotsRemaining, Instant lastActivity,
                        boolean admin) {
}
```

- [ ] **Step 4: Run the status test**

Run: `mvn -q test -Dtest=AuctionStatusTest`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing API test**

```java
package com.fantaagent.adapter.in.api;

import com.fantaagent.domain.player.Role;
import com.fantaagent.testsupport.AuctionApiFixture;
import com.fantaagent.testsupport.TestCatalogConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.context.WebApplicationContext;

import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
@Import(TestCatalogConfig.class)
@TestPropertySource(properties = "fantaagent.data-dir=target/test-data-my-auctions-api")
class MyAuctionsApiTest {

    @Autowired
    private WebApplicationContext context;

    private AuctionApiFixture f;

    @BeforeEach
    void setUp() throws Exception {
        f = AuctionApiFixture.create(context);
    }

    private void buy(String buyerId) {
        var admin = f.view(f.annaId);
        admin.write(() -> admin.service().recordPurchase(f.player(Role.P, 0), buyerId, 10, UUID.randomUUID().toString()));
    }

    @Test
    void unAstaAppenaCreataEDaIniziare() throws Exception {
        f.mvc.perform(get("/api/auctions").cookie(f.bruno))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(f.auctionId))
                .andExpect(jsonPath("$[0].leagueId").value(f.leagueId))
                .andExpect(jsonPath("$[0].leagueName").isString())
                .andExpect(jsonPath("$[0].status").value("NOT_STARTED"))
                .andExpect(jsonPath("$[0].admin").value(false))
                .andExpect(jsonPath("$[0].lastActivity").isString());
    }

    @Test
    void dopoUnAcquistoEInCorsoEDiceQuantoTiResta() throws Exception {
        buy(f.brunoId);
        f.mvc.perform(get("/api/auctions").cookie(f.bruno))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$[0].phase").value("P"))
                .andExpect(jsonPath("$[0].budgetRemaining").value(490));
        f.mvc.perform(get("/api/auctions").cookie(f.anna))
                .andExpect(jsonPath("$[0].admin").value(true));
    }

    @Test
    void lePiuRecentiPrima() throws Exception {
        f.mvc.perform(post("/api/leagues/" + f.leagueId + "/auctions").with(csrf()).cookie(f.anna)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Riparazione\"}"))
                .andExpect(status().isCreated());
        f.mvc.perform(get("/api/auctions").cookie(f.anna))
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].name").value("Riparazione"));
        buy(f.brunoId);
        f.mvc.perform(get("/api/auctions").cookie(f.anna))
                .andExpect(jsonPath("$[0].id").value(f.auctionId));
    }

    @Test
    void chiNonEInLegaNonVedeNiente() throws Exception {
        f.mvc.perform(get("/api/auctions").cookie(f.stranger("Dario")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void leAsteEliminateNonCompaiono() throws Exception {
        f.mvc.perform(delete("/api/leagues/" + f.leagueId + "/auctions/" + f.auctionId).with(csrf()).cookie(f.anna))
                .andExpect(status().isNoContent());
        f.mvc.perform(get("/api/auctions").cookie(f.anna))
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void senzaAccessoEUn401() throws Exception {
        f.mvc.perform(get("/api/auctions")).andExpect(status().isUnauthorized());
    }
}
```

Note for the implementer: check in `LeagueAuctionsApiTest` the exact status the DELETE returns and how an anonymous `/api/**` request is answered (`LeagueApiTest` has an example); align the two expectations above to what the existing API already does — the test must describe the real contract, not invent one.

- [ ] **Step 6: Run it to verify it fails**

Run: `mvn -q test -Dtest=MyAuctionsApiTest`
Expected: FAIL with 404 on `/api/auctions` (or 401 for every call).

- [ ] **Step 7: Implement `mine` in `LeagueAuctionService`**

Add after `list(...)`:

```java
    /**
     * Le aste in cui l'utente ha un posto, in tutte le leghe che gli passano: per la
     * home. Le piu' recenti prima; un'asta senza eventi oltre l'avvio conta la sua
     * creazione.
     */
    public List<MyAuction> mine(List<LeagueAccess> accesses) {
        List<MyAuction> out = new ArrayList<>();
        for (LeagueAccess access : accesses) {
            String me = access.userId().toString();
            for (AuctionRecord a : auctions.byLeague(access.leagueId())) {
                List<Seat> seats = auctions.seats(a.id());
                if (seats.stream().noneMatch(s -> s.userId().equals(access.userId()))) continue;
                List<AuctionEvent> events = stores.open(a.id(), access.userId()).load();
                int slotsPerTeam = a.rules().slots().values().stream().mapToInt(Integer::intValue).sum();
                int purchases = LogSummary.purchases(events);
                Instant last = LogSummary.lastWritten(events);
                out.add(new MyAuction(a.id(), access.leagueId(), access.league().name(), a.name(),
                        AuctionStatus.of(purchases, seats.size() * slotsPerTeam),
                        LogSummary.phase(events, phases.getFirst()),
                        a.rules().budget() - LogSummary.spentBy(events, me),
                        slotsPerTeam - LogSummary.playersOf(events, me).size(),
                        last != null ? last : a.createdAt(),
                        access.isAdmin()));
            }
        }
        out.sort(java.util.Comparator.comparing(MyAuction::lastActivity).reversed());
        return List.copyOf(out);
    }
```

Check `access.league().name()` exists on `League` (it is used by `LeagueCard.of`); if the accessor has another name, use that one.

- [ ] **Step 8: Implement the controller**

```java
package com.fantaagent.adapter.in.api;

import com.fantaagent.adapter.in.security.AppUserPrincipal;
import com.fantaagent.application.service.auction.LeagueAuctionService;
import com.fantaagent.application.service.auction.MyAuction;
import com.fantaagent.application.service.league.LeagueService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

/** Le aste dell'utente in tutte le sue leghe: la prima cosa della home. */
@RestController
public class MyAuctionsApi {

    private final LeagueService leagues;
    private final LeagueAuctionService auctions;

    public MyAuctionsApi(LeagueService leagues, LeagueAuctionService auctions) {
        this.leagues = leagues;
        this.auctions = auctions;
    }

    public record MyAuctionView(String id, String leagueId, String leagueName, String name, String status,
                                String phase, int budgetRemaining, int slotsRemaining, Instant lastActivity,
                                boolean admin) {
        static MyAuctionView of(MyAuction a) {
            return new MyAuctionView(a.id().toString(), a.leagueId().toString(), a.leagueName(), a.name(),
                    a.status().name(), a.phase().name(), a.budgetRemaining(), a.slotsRemaining(),
                    a.lastActivity(), a.admin());
        }
    }

    @GetMapping("/api/auctions")
    public List<MyAuctionView> mine(@AuthenticationPrincipal AppUserPrincipal me) {
        return auctions.mine(leagues.mine(me.id())).stream().map(MyAuctionView::of).toList();
    }
}
```

If `Role.name()` does not give `P`/`D`/`C`/`A`, use the same conversion `LeagueDtos.AuctionCardView.of` uses for `phase`.

- [ ] **Step 9: Run the backend tests**

Run: `mvn -q test -Dtest='MyAuctionsApiTest,AuctionStatusTest,LeagueAuctionsApiTest,LeagueAuctionServiceTest'` then `mvn -q test`
Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add src/main/java src/test/java
git commit -m "Le mie aste: le aste di tutte le leghe dell'utente, con stato e quanto gli resta"
```

---

### Task 2: Le quattro primitive condivise

**Files:**
- Create: `frontend/src/domain/PageHeader.tsx`, `frontend/src/domain/Modal.tsx`, `frontend/src/domain/SaveBar.tsx`, `frontend/src/domain/SettingsLayout.tsx`
- Test: `frontend/src/domain/PageHeader.test.tsx`, `Modal.test.tsx`, `SaveBar.test.tsx`, `SettingsLayout.test.tsx`

**Interfaces:**
- Produces:
  - `PageHeader({ title: string; context?: ReactNode; leading?: ReactNode; actions?: ReactNode; titleId?: string })` — `<header>` con `h1`.
  - `Modal({ open: boolean; titleId: string; title: string; onClose: () => void; children: ReactNode; initialFocusRef?: RefObject<HTMLElement | null>; className?: string })` — `<dialog>` modale.
  - `SaveBar({ dirty: boolean; pending: boolean; error: string | null; saveLabel: string; onSave: () => void; onReset: () => void })`.
  - `SettingsLayout({ title: string; context?: ReactNode; sections: { id: string; label: string; shortLabel?: string }[]; ready: boolean; children: ReactNode; footer?: ReactNode; saveBar?: ReactNode })`.
  - `SAVE_BAR_H = 'h-18'` (72px) e `SAVE_BAR_SPACE = 'pb-24'` esportate da `SaveBar.tsx`.

- [ ] **Step 1: Write the failing tests**

`PageHeader.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('ha un h1 col titolo e la riga di contesto', () => {
    render(<PageHeader title="Le tue aste" context="3 in corso" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Le tue aste' })).toBeInTheDocument();
    expect(screen.getByText('3 in corso')).toBeInTheDocument();
  });

  // L'oro della pagina sta nel contenuto, mai nell'intestazione.
  it('le azioni stanno in un gruppo e non sono oro', () => {
    render(<PageHeader title="T" actions={<button type="button" className="border">Crea</button>} />);
    const group = screen.getByRole('group', { name: 'Azioni della pagina' });
    expect(group).toContainElement(screen.getByRole('button', { name: 'Crea' }));
    expect(group.innerHTML).not.toContain('bg-accent');
  });

  it('sotto sm le azioni vanno sotto il titolo, a tutta larghezza', () => {
    render(<PageHeader title="T" actions={<button type="button">A</button>} />);
    expect(screen.getByRole('group', { name: 'Azioni della pagina' }).className).toContain('max-sm:w-full');
  });
});
```

`Modal.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

describe('Modal', () => {
  it('chiusa non c e', () => {
    render(<Modal open={false} titleId="t" title="Crea una lega" onClose={() => {}}>x</Modal>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('aperta e una finestra col suo titolo, e Esc chiama onClose', async () => {
    const onClose = vi.fn();
    render(<Modal open titleId="t" title="Crea una lega" onClose={onClose}><input aria-label="Nome" /></Modal>);
    expect(screen.getByRole('dialog', { name: 'Crea una lega' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('ha un bottone Chiudi', async () => {
    const onClose = vi.fn();
    render(<Modal open titleId="t" title="T" onClose={onClose}>x</Modal>);
    await userEvent.click(screen.getByRole('button', { name: 'Chiudi' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('sotto sm a tutto schermo, da sm larga 32rem', () => {
    render(<Modal open titleId="t" title="T" onClose={() => {}}>x</Modal>);
    const cls = screen.getByRole('dialog').className;
    expect(cls).toContain('max-sm:h-dvh');
    expect(cls).toContain('sm:w-[32rem]');
  });
});
```

`SaveBar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SaveBar } from './SaveBar';

const base = { pending: false, error: null, saveLabel: 'Salva le regole', onSave: () => {}, onReset: () => {} };

describe('SaveBar', () => {
  it('senza modifiche dice Tutto salvato e i bottoni non sono attivi', () => {
    render(<SaveBar {...base} dirty={false} />);
    expect(screen.getByText('Tutto salvato')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salva le regole' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Annulla' })).toBeDisabled();
  });

  it('con modifiche dice Modifiche non salvate e salva', async () => {
    const onSave = vi.fn();
    render(<SaveBar {...base} dirty onSave={onSave} />);
    expect(screen.getByText('Modifiche non salvate')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salva le regole' }));
    expect(onSave).toHaveBeenCalled();
  });

  it('Annulla torna a cio che e salvato', async () => {
    const onReset = vi.fn();
    render(<SaveBar {...base} dirty onReset={onReset} />);
    await userEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(onReset).toHaveBeenCalled();
  });

  it('l errore e l unico alert', () => {
    render(<SaveBar {...base} dirty error="Non sono riuscito a salvare." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Non sono riuscito a salvare.');
  });

  // Due stati della stessa misura: la barra non salta quando si comincia a scrivere.
  it('ha un altezza fissa ed e ferma in fondo alla finestra', () => {
    const { container } = render(<SaveBar {...base} dirty={false} />);
    const bar = container.firstElementChild as HTMLElement;
    expect(bar.className).toContain('fixed');
    expect(bar.className).toContain('bottom-0');
    expect(bar.className).toContain('h-18');
  });
});
```

`SettingsLayout.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SettingsLayout } from './SettingsLayout';

const sections = [
  { id: 's-a', label: 'Banditore' },
  { id: 's-b', label: 'Crediti e posti', shortLabel: 'Crediti' },
];

function renderLayout() {
  return render(
    <SettingsLayout title="Regole della lega" context="Valgono per le prossime aste." sections={sections} ready
      saveBar={<div data-testid="bar" />}>
      <section id="s-a" aria-labelledby="h-a"><h2 id="h-a">Banditore</h2></section>
      <section id="s-b" aria-labelledby="h-b"><h2 id="h-b">Crediti e posti</h2></section>
    </SettingsLayout>,
  );
}

describe('SettingsLayout', () => {
  it('ha l intestazione con h1', () => {
    renderLayout();
    expect(screen.getByRole('heading', { level: 1, name: 'Regole della lega' })).toBeInTheDocument();
  });

  it('un indice solo, con un link per sezione', () => {
    renderLayout();
    const nav = screen.getByRole('navigation', { name: 'Sezioni' });
    expect(nav.querySelectorAll('a[href="#s-a"]')).toHaveLength(2); // computer + telefono
    expect(screen.getAllByRole('link', { name: 'Banditore' }).length).toBeGreaterThan(0);
  });

  it('la fila del telefono usa le etichette corte e non scorre di lato', () => {
    renderLayout();
    const phone = screen.getByTestId('settings-index-phone');
    expect(phone.className).toContain('lg:hidden');
    expect(phone.className).not.toContain('overflow-x-auto');
    expect(phone).toHaveTextContent('Crediti');
  });

  it('il contenuto lascia in fondo lo spazio della barra', () => {
    renderLayout();
    expect(screen.getByTestId('settings-content').className).toContain('pb-24');
    expect(screen.getByTestId('bar')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd frontend && npx vitest run src/domain/PageHeader.test.tsx src/domain/Modal.test.tsx src/domain/SaveBar.test.tsx src/domain/SettingsLayout.test.tsx`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`PageHeader.tsx`:

```tsx
import type { ReactNode } from 'react';

/**
 * L'intestazione di ogni pagina di gestione: titolo, una riga di contesto, al
 * massimo due azioni normali. L'oro della pagina sta nel contenuto, mai qui.
 */
export function PageHeader({ title, context, leading, actions, titleId }: {
  title: string;
  context?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  titleId?: string;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-center gap-4">
      {leading}
      <div className="min-w-0 flex-1">
        <h1 id={titleId} className="w-exp text-2xl font-bold md:text-3xl">{title}</h1>
        {context ? <p className="mt-1 text-sm text-muted-foreground">{context}</p> : null}
      </div>
      {actions ? (
        <div role="group" aria-label="Azioni della pagina"
          className="flex gap-3 max-sm:w-full max-sm:[&>*]:flex-1">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
```

`Modal.tsx` (modeled on `DeleteAuctionDialog`):

```tsx
import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { FOCUS_RING } from './controls';
import { RemoveIcon } from './RemoveIcon';

/**
 * Una finestra sopra la pagina: {@code <dialog>} nativo con showModal(), che
 * intrappola il fuoco, rende inerte lo sfondo e trasforma Esc in cancel. Chiusa,
 * il browser riporta il fuoco a chi l'ha aperta. Sotto sm a tutto schermo; da sm
 * larga 32rem. L'altezza la decide chi la usa, sul suo stato piu' alto.
 */
export function Modal({ open, titleId, title, onClose, children, initialFocusRef, className = '' }: {
  open: boolean;
  titleId: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    if (!dialog.open) dialog.showModal();
    initialFocusRef?.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open, initialFocusRef]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      className={`panel m-auto flex flex-col p-0 text-foreground backdrop:bg-black/60 max-sm:h-dvh max-sm:max-h-none max-sm:w-screen max-sm:max-w-none max-sm:rounded-none sm:w-[32rem] ${className}`}
    >
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
        <h2 id={titleId} className="w-exp text-xl font-bold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Chiudi"
          className={`grid size-11 shrink-0 place-items-center rounded-lg border border-control-border hover:bg-line ${FOCUS_RING}`}>
          <RemoveIcon />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-5">{children}</div>
    </dialog>
  );
}
```

(Check `RemoveIcon`'s export name in `domain/RemoveIcon.tsx` and use it as is.)

`SaveBar.tsx`:

```tsx
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from './controls';

/** L'altezza della barra e lo spazio che il contenuto lascia sotto di se'. */
export const SAVE_BAR_H = 'h-18';
export const SAVE_BAR_SPACE = 'pb-24';

/**
 * L'unica barra di salvataggio delle impostazioni: ferma in fondo alla finestra,
 * sempre della stessa altezza. Senza modifiche dice «Tutto salvato» e non ha
 * niente da premere; con modifiche offre «Annulla» e il salvataggio (l'oro della
 * pagina). Un errore di salvataggio e' l'unico role="alert" della pagina.
 */
export function SaveBar({ dirty, pending, error, saveLabel, onSave, onReset }: {
  dirty: boolean;
  pending: boolean;
  error: string | null;
  saveLabel: string;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className={`fixed inset-x-0 bottom-0 z-20 ${SAVE_BAR_H} border-t border-panel-border bg-bar pb-[env(safe-area-inset-bottom)]`}>
      <div className="mx-auto flex h-full max-w-[96rem] items-center gap-3 px-4 md:px-6">
        <p className="min-w-0 flex-1 truncate text-sm">
          {error ? (
            <span role="alert" className="font-medium text-destructive">{error}</span>
          ) : (
            <span className={dirty ? 'text-foreground' : 'text-muted-foreground'}>
              {dirty ? 'Modifiche non salvate' : 'Tutto salvato'}
            </span>
          )}
        </p>
        <button type="button" disabled={!dirty || pending} onClick={onReset} className={BUTTON_SECONDARY}>
          Annulla
        </button>
        <button type="button" disabled={!dirty || pending} onClick={onSave} className={`${BUTTON_PRIMARY} px-5`}>
          {pending ? 'Salvo…' : saveLabel}
        </button>
      </div>
    </div>
  );
}
```

If `h-18` is not a Tailwind v4 spacing value in this project, it is (v4 spacing is a multiplier: `h-18` = 4.5rem). Keep it.

`SettingsLayout.tsx`:

```tsx
import type { ReactNode } from 'react';
import { FOCUS_RING } from './controls';
import { PageHeader } from './PageHeader';
import { SAVE_BAR_SPACE } from './SaveBar';
import { useActiveSection } from './useActiveSection';

export interface SettingsSection { id: string; label: string; shortLabel?: string }

/**
 * Lo schema comune di regole, impostazioni dell'asta e profilo. Da lg l'indice a
 * sinistra, fermo, e il contenuto largo fino a 48rem; sotto lg l'indice e' una
 * fila sotto la barra in alto, ferma, con le etichette corte: si stringe, non
 * scorre di lato. Scorre la pagina, non un riquadro. In fondo il contenuto lascia
 * lo spazio della barra di salvataggio.
 */
export function SettingsLayout({ title, context, sections, ready, children, footer, saveBar }: {
  title: string;
  context?: ReactNode;
  sections: SettingsSection[];
  ready: boolean;
  children: ReactNode;
  footer?: ReactNode;
  saveBar?: ReactNode;
}) {
  const active = useActiveSection(sections.map((s) => s.id), ready);
  const link = (s: SettingsSection, short: boolean) => (
    <a key={s.id} href={`#${s.id}`} aria-current={active === s.id ? 'location' : undefined}
      className={`flex min-h-11 items-center rounded-lg px-3 text-sm font-medium ${FOCUS_RING} ${
        active === s.id ? 'bg-surface-raised text-accent' : 'text-muted-foreground hover:text-foreground'
      } ${short ? 'flex-1 justify-center text-center' : ''}`}>
      {short ? (s.shortLabel ?? s.label) : s.label}
    </a>
  );

  return (
    <div className="mx-auto w-full max-w-[66rem]">
      <PageHeader title={title} context={context} />
      <div className="grid gap-x-8 lg:grid-cols-[14rem_minmax(0,48rem)]">
        {/* Un solo punto di riferimento «Sezioni» con le due forme dell'indice: la
            fila del telefono (lg:hidden) e l'elenco del computer (max-lg:hidden). */}
        <nav aria-label="Sezioni" className="lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:self-start">
          <div data-testid="settings-index-phone"
            className="sticky top-[var(--header-h)] z-10 -mx-4 mb-4 flex gap-1 border-b border-panel-border bg-background px-4 py-1 md:-mx-6 md:px-6 lg:hidden">
            {sections.map((s) => link(s, true))}
          </div>
          <ol className="flex flex-col gap-1 max-lg:hidden">
            {sections.map((s) => <li key={s.id}>{link(s, false)}</li>)}
          </ol>
        </nav>
        {/* Ogni sezione ha scroll-mt-[calc(var(--header-h)+4rem)]: il link
            dell'indice la porta sotto la barra e la fila ferma, non dietro. */}
        <div data-testid="settings-content" className={`flex min-w-0 flex-col gap-6 ${SAVE_BAR_SPACE}`}>
          {children}
          {footer}
        </div>
      </div>
      {saveBar}
    </div>
  );
}
```

Note: the phone row is `sticky` inside a `nav` that is not sticky below lg; if the sticky row does not stick because its parent `nav` is only as tall as the row, move `lg:hidden` row's stickiness to the `nav` itself below lg (`max-lg:sticky max-lg:top-[var(--header-h)] max-lg:z-10`) and drop `sticky` from the row. Verify in the browser at 390×844 that the row stays under the bar while scrolling.

- [ ] **Step 4: Run the tests**

Run: `cd frontend && npx vitest run src/domain/PageHeader.test.tsx src/domain/Modal.test.tsx src/domain/SaveBar.test.tsx src/domain/SettingsLayout.test.tsx`
Expected: PASS. Then `npm test`, `npm run lint`, `npm run build`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/domain
git commit -m "Le primitive delle pagine di gestione: intestazione, finestra, barra di salvataggio, schema delle impostazioni"
```

---

### Task 3: La home centrata sulle aste

**Files:**
- Modify: `frontend/src/api/types.ts`, `frontend/src/api/leagues.ts`
- Create: `frontend/src/domain/MyAuctionCard.tsx`, `frontend/src/domain/CreateLeagueDialog.tsx`, `frontend/src/domain/JoinLeagueDialog.tsx`
- Modify: `frontend/src/routes/LeaguesRoute.tsx`, `frontend/src/routes/LeaguesRoute.test.tsx`
- Modify: `frontend/scripts/screens.mjs` (mock di `/api/auctions`; schermate `08c-crea-lega`, `08d-unisciti` con la finestra aperta)
- Test: `frontend/src/domain/MyAuctionCard.test.tsx`, `JoinLeagueDialog.test.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `Modal` (Task 2); `GET /api/auctions` (Task 1).
- Produces:
  - `export interface MyAuction { id: string; leagueId: string; leagueName: string; name: string; status: 'NOT_STARTED' | 'IN_PROGRESS' | 'CONCLUDED'; phase: Role; budgetRemaining: number; slotsRemaining: number; lastActivity: string; admin: boolean }` in `api/types.ts`.
  - `useMyAuctions()` in `api/leagues.ts`, key `LEAGUE_KEYS.myAuctions = ['my-auctions']`; `useCreateAuction`, `useDeleteAuction`, `useUpdateAuction`, `useCreateLeague`, `useAcceptInvite`, `useDecideJoin` also invalidate `LEAGUE_KEYS.myAuctions`.
  - `MyAuctionCard({ auction: MyAuction; primary: boolean })`.
  - `CreateLeagueDialog({ open, onClose })`, `JoinLeagueDialog({ open, onClose })`.

- [ ] **Step 1: Write the failing tests**

`MyAuctionCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { MyAuction } from '../api/types';
import { MyAuctionCard } from './MyAuctionCard';

const auction: MyAuction = {
  id: 'a1', leagueId: 'l1', leagueName: 'Lega dei Colizzati', name: 'Asta estiva 2026',
  status: 'IN_PROGRESS', phase: 'C', budgetRemaining: 120, slotsRemaining: 11,
  lastActivity: '2026-10-01T10:00:00Z', admin: true,
};

function renderCard(primary: boolean, a: MyAuction = auction) {
  return render(<MemoryRouter><MyAuctionCard auction={a} primary={primary} /></MemoryRouter>);
}

describe('MyAuctionCard', () => {
  it('dice lega, asta, stato, fase e quanto ti resta', () => {
    renderCard(true);
    expect(screen.getByText('Lega dei Colizzati')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Asta estiva 2026' })).toBeInTheDocument();
    expect(screen.getByText('In corso')).toBeInTheDocument();
    expect(screen.getByText('Centrocampisti')).toBeInTheDocument();
    expect(screen.getByText(/120 crediti · 11 posti/)).toBeInTheDocument();
  });

  it('Entra nell asta porta all asta', () => {
    renderCard(true);
    expect(screen.getByRole('link', { name: 'Entra nell\'asta Asta estiva 2026' }))
      .toHaveAttribute('href', '/leghe/l1/aste/a1');
  });

  it('oro solo sulla prima', () => {
    renderCard(true);
    expect(screen.getByRole('link', { name: /Entra nell'asta/ }).className).toContain('bg-accent');
  });

  it('le altre normali', () => {
    renderCard(false);
    expect(screen.getByRole('link', { name: /Entra nell'asta/ }).className).not.toContain('bg-accent');
  });

  it('da iniziare lo dice', () => {
    renderCard(false, { ...auction, status: 'NOT_STARTED' });
    expect(screen.getByText('Da iniziare')).toBeInTheDocument();
  });
});
```

`JoinLeagueDialog.test.tsx` (mock `fetch` as `LeaguesRoute.test.tsx` already does for `/api/leagues/search`; reuse its helpers by moving the relevant cases):

```tsx
// Move from LeaguesRoute.test.tsx the cases that cover search results, «Chiedi di
// entrare», «Richiesta inviata», «Apri» and the invite-link form; render
// <JoinLeagueDialog open onClose={() => {}} /> inside the same QueryClient/MemoryRouter
// wrapper those tests use. Add:
it('i risultati scorrono dentro la loro area e la finestra non cambia altezza', async () => {
  // render, type 3 letters, await results
  const area = screen.getByTestId('join-results');
  expect(area.className).toContain('h-[24rem]');
  expect(area.className).toContain('overflow-y-auto');
});
it('il link d invito sta separato, sotto i risultati', () => {
  expect(screen.getByRole('group', { name: 'Hai un link d\'invito?' })).toBeInTheDocument();
});
```

`LeaguesRoute.test.tsx` — add (and drop assertions about the two always-open panels):

```tsx
it('in cima le aste in corso e da iniziare, la piu recente con l oro', async () => {
  // mock /api/auctions with two IN_PROGRESS (lastActivity desc) and one CONCLUDED
  renderLeagues();
  const cards = await screen.findAllByRole('article');
  expect(cards).toHaveLength(2);
  expect(within(cards[0]).getByRole('link', { name: /Entra nell'asta/ }).className).toContain('bg-accent');
  expect(within(cards[1]).getByRole('link', { name: /Entra nell'asta/ }).className).not.toContain('bg-accent');
});
it('le concluse in un elenco compatto, tre al massimo con Mostra tutte', async () => { /* 4 concluded → 3 rows + «Mostra tutte» → 4 rows */ });
it('crea e unisciti sono bottoni normali nell intestazione che aprono una finestra', async () => {
  renderLeagues();
  const group = await screen.findByRole('group', { name: 'Azioni della pagina' });
  await userEvent.click(within(group).getByRole('button', { name: 'Crea una lega' }));
  expect(screen.getByRole('dialog', { name: 'Crea una lega' })).toBeInTheDocument();
});
it('senza aste in corso una riga sola; per chi amministra «Prepara un asta» porta alla lega', async () => { /* … */ });
it('senza leghe uno stato vuoto con Crea una lega oro e Unisciti normale', async () => { /* … */ });
it('una sola azione oro nella pagina', async () => {
  renderLeagues();
  await screen.findAllByRole('article');
  expect(document.querySelectorAll('.bg-accent').length).toBe(1);
});
```

Write the bodies in full, using the file's existing fetch-mock helper (extend it with an `auctions` array answered on `/api/auctions`).

- [ ] **Step 2: Run them to verify they fail**

Run: `cd frontend && npx vitest run src/domain/MyAuctionCard.test.tsx src/domain/JoinLeagueDialog.test.tsx src/routes/LeaguesRoute.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Types and hook**

In `api/types.ts` add `MyAuction` (shape in Interfaces). In `api/leagues.ts`:

```ts
// in LEAGUE_KEYS
  myAuctions: ['my-auctions'] as const,

/** Le tue aste in tutte le leghe, per la home. Cambiano quando si compra: si
 *  rileggono tornando sulla pagina, non a intervalli. */
export function useMyAuctions() {
  return useQuery({ queryKey: LEAGUE_KEYS.myAuctions, queryFn: () => api<MyAuction[]>('/api/auctions'), ...STILL });
}
```

Add `client.invalidateQueries({ queryKey: LEAGUE_KEYS.myAuctions })` to the `onSuccess` of `useCreateLeague`, `useAcceptInvite`, `useDecideJoin`, `useCreateAuction`, `useUpdateAuction`, `useDeleteAuction` (wrap in `Promise.all` where there is already one invalidation).

- [ ] **Step 4: `MyAuctionCard`**

```tsx
import { Link } from 'react-router-dom';
import type { MyAuction } from '../api/types';
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from './controls';
import { RoleBadge } from './RoleBadge';
import { ROLE_NAME_PLURAL_CAPITALIZED } from './roles';

const STATUS: Record<MyAuction['status'], string> = {
  NOT_STARTED: 'Da iniziare', IN_PROGRESS: 'In corso', CONCLUDED: 'Conclusa',
};

/**
 * Un'asta della home: tutte le schede hanno la stessa altezza (min-h-52), e il
 * bottone sta sempre in fondo. Oro solo sulla prima, l'asta toccata per ultima.
 */
export function MyAuctionCard({ auction: a, primary }: { auction: MyAuction; primary: boolean }) {
  const titleId = `my-auction-${a.id}`;
  return (
    <article aria-labelledby={titleId} className="panel flex min-h-52 flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{a.leagueName}</p>
          <h3 id={titleId} className="w-exp text-xl font-bold">{a.name}</h3>
        </div>
        <span className={`shrink-0 rounded-full border px-3 py-1 text-meta font-semibold ${
          a.status === 'IN_PROGRESS' ? 'border-positive text-positive' : 'border-line-strong text-muted-foreground'
        }`}>{STATUS[a.status]}</span>
      </div>
      <p className="flex items-center gap-2 text-sm">
        <RoleBadge role={a.phase} />
        <span>{ROLE_NAME_PLURAL_CAPITALIZED[a.phase]}</span>
      </p>
      <p className="tnum text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{a.budgetRemaining}</span>
        {` crediti · ${a.slotsRemaining} posti`}
      </p>
      <Link to={`/leghe/${a.leagueId}/aste/${a.id}`} aria-label={`Entra nell'asta ${a.name}`}
        className={`mt-auto w-full ${primary ? BUTTON_PRIMARY : BUTTON_SECONDARY}`}>
        Entra nell&apos;asta
      </Link>
    </article>
  );
}
```

The status pill uses `rounded-full`: add `MyAuctionCard.tsx` to the `PILLS` allow-list in `shapes.test.ts` (that file explains the rule). Check that `text-positive` / `border-positive` exist in `tokens.css`; if the pill fails `contrast.test.ts`, use the token that test accepts for small text.

- [ ] **Step 5: The two dialogs**

Move the bodies of `CreateLeaguePanel` and `JoinLeaguePanel` (with `SearchResults`, `RequestForm`, `InviteLinkForm`, `useDebounced`, `inviteToken`) out of `LeaguesRoute.tsx` into `CreateLeagueDialog.tsx` and `JoinLeagueDialog.tsx`, keeping their logic and messages, wrapped in `Modal`:

```tsx
export function CreateLeagueDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateLeague();
  const navigate = useNavigate();
  const nameRef = useRef<HTMLInputElement>(null);
  return (
    <Modal open={open} titleId="create-league-title" title="Crea una lega" onClose={onClose} initialFocusRef={nameRef}>
      {/* the existing create form: «Nome della lega», «La tua squadra», «Crea la lega» (BUTTON_PRIMARY) */}
      {/* on success: onClose(); navigate(`/leghe/${created.id}`) */}
    </Modal>
  );
}
```

`JoinLeagueDialog`: search field on top; results in `<div data-testid="join-results" className="h-[24rem] overflow-y-auto">` (six 64px rows); below, separated by `border-t border-line pt-4 mt-4`, a `<fieldset>` / `role="group"` labelled «Hai un link d'invito?» with the existing `InviteLinkForm`. Results rows follow §3.2: name + «amministra X · N membri» on the left (no truncation), the action always in the right column: «Chiedi di entrare», «Richiesta inviata» (disabled), «Apri» (Link). `TextField`'s `ref` support: if `TextField` doesn't forward refs, focus the input by id in `initialFocusRef` via `useRef` + `document.getElementById` in an effect, or add `forwardRef` to `TextField` (small change, keep it).

`inviteToken` is exported and tested today from `LeaguesRoute.tsx`: re-export it from `LeaguesRoute.tsx` (`export { inviteToken } from '../domain/JoinLeagueDialog'`) so existing imports keep working, or update the importers.

- [ ] **Step 6: Rewrite `LeaguesRoute`**

```tsx
export function LeaguesRoute() {
  const leagues = useLeagues();
  const auctions = useMyAuctions();
  const requests = useMyJoinRequests();
  const [dialog, setDialog] = useState<'create' | 'join' | null>(null);
  const [allConcluded, setAllConcluded] = useState(false);
  const live = (auctions.data ?? []).filter((a) => a.status !== 'CONCLUDED');
  const concluded = (auctions.data ?? []).filter((a) => a.status === 'CONCLUDED');
  const hasLeagues = (leagues.data?.length ?? 0) > 0 || (requests.data?.length ?? 0) > 0;
  const firstAdminLeague = leagues.data?.find((l) => l.admin);

  return (
    <AppShell chrome="top" trail={[{ label: 'Le mie leghe' }]}>
      <PageFrame>
        <PageHeader title="Le tue aste"
          actions={<>
            <button type="button" className={BUTTON_SECONDARY} onClick={() => setDialog('create')}>Crea una lega</button>
            <button type="button" className={BUTTON_SECONDARY} onClick={() => setDialog('join')}>Unisciti a una lega</button>
          </>} />
        {/* loading: skeleton cards of the same min-h-52; error: one role="alert" */}
        {leagues.data && !hasLeagues ? <NoLeagues onCreate={() => setDialog('create')} onJoin={() => setDialog('join')} /> : (
          <>
            <section aria-labelledby="live-title" className="mb-8">
              <h2 id="live-title" className="sr-only">Aste in corso e da iniziare</h2>
              {live.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {live.map((a, i) => <MyAuctionCard key={a.id} auction={a} primary={i === 0} />)}
                </div>
              ) : (
                <div className="panel flex min-h-16 flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <p className="text-sm text-muted-foreground">Nessuna asta in corso</p>
                  {firstAdminLeague ? (
                    <Link to={`/leghe/${firstAdminLeague.id}`} className={BUTTON_SECONDARY}>Prepara un&apos;asta</Link>
                  ) : null}
                </div>
              )}
            </section>
            {concluded.length > 0 ? (
              <section aria-labelledby="done-title" className="panel mb-8">
                {/* h2 «Concluse»; rows (§3.2, min-h-16) linking to the auction; first 3 unless allConcluded; «Mostra tutte» BUTTON_SECONDARY */}
              </section>
            ) : null}
            <section aria-labelledby="leagues-title" className="panel">
              {/* h2 «Le tue leghe» + count; the existing LeagueRow and PendingRow, unchanged in content */}
            </section>
          </>
        )}
        <CreateLeagueDialog open={dialog === 'create'} onClose={() => setDialog(null)} />
        <JoinLeagueDialog open={dialog === 'join'} onClose={() => setDialog(null)} />
      </PageFrame>
    </AppShell>
  );
}
```

`NoLeagues`: one panel (`panel p-6`), «Non sei ancora in nessuna lega», a short line, and two big buttons side by side (stacked below sm): «Crea una lega» `BUTTON_PRIMARY`, «Unisciti a una lega» `BUTTON_SECONDARY`. Remove the old `FirstSteps`.

Gold count: with live auctions, the only gold is the first card's link; with none and leagues present, there is no gold; with no leagues, «Crea una lega» in `NoLeagues`. The header buttons are never gold.

- [ ] **Step 7: Screens**

In `frontend/scripts/screens.mjs`, add a mock for `GET /api/auctions` built from the same fixture leagues (two `IN_PROGRESS`, one `NOT_STARTED`, four `CONCLUDED`), and two new shots: `08c-crea-lega` (click «Crea una lega») and `08d-unisciti` (click «Unisciti a una lega», type three letters). Replace `08b-le-mie-leghe-ricerca` with `08d`.

- [ ] **Step 8: Run tests and screens**

Run: `cd frontend && npm test && npm run lint && npm run build && SIZES=1440x900,390x844,360x740 npm run screens -- test-results/screens/gestione-3`
Expected: all green; `larghe: []`; look at `08-*`, `08c-*`, `08d-*`: no big empty area, one gold.

- [ ] **Step 9: Commit**

```bash
git add frontend
git commit -m "La home sulle aste: le tue aste in cima, le leghe sotto, crea e unisciti in una finestra"
```

---

### Task 4: La lega

**Files:**
- Create: `frontend/src/domain/MemberMenu.tsx`, `frontend/src/domain/MemberMenu.test.tsx`
- Modify: `frontend/src/routes/LeagueRoute.tsx`, `frontend/src/routes/LeagueRoute.test.tsx`

**Interfaces:**
- Consumes: `PageHeader` (Task 2); `AuctionAdminMenu`, `RenameAuctionDialog`, `DeleteAuctionDialog`, `LeaveLeagueDialog` (existing).
- Produces: `MemberMenu({ teamName: string; onRemove: () => void })` — «…» menu with one item «Togli dalla lega», modeled on `AuctionAdminMenu`.

- [ ] **Step 1: Write the failing tests**

`MemberMenu.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemberMenu } from './MemberMenu';

describe('MemberMenu', () => {
  it('un bottone per riga, col nome della squadra', () => {
    render(<MemberMenu teamName="Longobarda" onRemove={() => {}} />);
    expect(screen.getByRole('button', { name: 'Azioni per Longobarda' })).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('dentro, Togli dalla lega', async () => {
    const onRemove = vi.fn();
    render(<MemberMenu teamName="Longobarda" onRemove={onRemove} />);
    await userEvent.click(screen.getByRole('button', { name: 'Azioni per Longobarda' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Togli dalla lega' }));
    expect(onRemove).toHaveBeenCalled();
  });
});
```

`LeagueRoute.test.tsx` — add (adapt the existing fixtures/helpers in the file):

```tsx
it('l intestazione ha h1, il contesto e Regole della lega come bottone normale', async () => { /* PageHeader group contains link «Regole della lega» without bg-accent */ });
it('Nuova asta apre il campo del nome in cima all elenco; Crea l asta e l unico oro', async () => {
  // admin: no textbox «Nome della nuova asta» at first
  // click «Nuova asta» → textbox appears, focus is in it, «Crea l'asta» has bg-accent, «Annulla» closes it
  // document.querySelectorAll('.bg-accent').length === 1 while open, 0 when closed
});
it('ogni asta ha Entra e il menu', async () => { /* link «Entra in Asta estiva 2026» href, button «Azioni per Asta estiva 2026» */ });
it('Accetta e Rifiuta sono bottoni normali', async () => { /* no bg-accent on «Accetta Hellas Madonna» */ });
it('togliere un membro passa dal menu e chiede conferma', async () => {
  // no button named /^Togli /; open «Azioni per Longobarda», «Togli dalla lega», dialog «Togliere «Longobarda» dalla lega?»
});
it('chi non amministra non vede Nuova asta, Importa, menu, richieste, inviti', async () => { /* … */ });
it('nel documento: aste, poi richieste, membri, inviti', async () => {
  const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
  expect(headings).toEqual(['Aste', 'Richieste di ingresso', 'Membri', 'Inviti']);
});
```

Write every body in full with the file's existing render helper and fetch mocks.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd frontend && npx vitest run src/domain/MemberMenu.test.tsx src/routes/LeagueRoute.test.tsx`
Expected: FAIL.

- [ ] **Step 3: `MemberMenu`**

Copy the structure of `AuctionAdminMenu.tsx` (button «…» with `aria-haspopup="menu"`, `aria-expanded`, a `role="menu"` list, Esc and outside click close, focus returns to the button) with a single `menuitem` «Togli dalla lega» calling `onRemove`. Button `aria-label={`Azioni per ${teamName}`}`, 44×44.

- [ ] **Step 4: Rewrite `LeagueRoute`**

Layout:

```tsx
<PageFrame>
  <PageHeader title={name} titleId="league-title"
    leading={<Crest …existing initial square… />}
    context={`${admin ? 'Amministri tu · ' : ''}${members} membri · ${auctions} aste`}
    actions={<Link to={`/leghe/${leagueId}/regole`} className={BUTTON_SECONDARY}>Regole della lega</Link>} />
  <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
    <AuctionsPanel … />                        {/* panel, self-start: tall as its content */}
    <div className="flex flex-col gap-6">
      {admin ? <JoinRequestsPanel … /> : null} {/* only when there are requests, as today */}
      <MembersPanel … />
      {admin ? <InvitesPanel … /> : null}
    </div>
  </div>
</PageFrame>
```

`AuctionsPanel` changes:
- Heading row: `h2` «Aste»; for admin two `BUTTON_SECONDARY`: «Nuova asta» (toggles `creating`) and «Importa un'asta» (Link).
- When `creating`: the existing form at the top of the list, with `autoFocus` on the name field, «Crea l'asta» `BUTTON_PRIMARY`, «Annulla» `BUTTON_SECONDARY` (closes and resets `create`).
- Each row (§3.2, `min-h-16`): left the name (`font-semibold`, not truncated) and the detail line (status word from `purchases`/`totalSlots`: «Da iniziare» / «In corso» / «Conclusa», then phase, then «ti restano N crediti»); right a `BUTTON_SECONDARY` Link «Entra» with `aria-label={`Entra in ${a.name}`}`, then `AuctionAdminMenu` for admin.
- Remove `flex-1`/`min-h-40` stretching: the panel is as tall as its content (`self-start`); the empty state is the one-line row of §3.5.

`JoinRequestsPanel`: «Accetta» becomes `BUTTON_SECONDARY` (keep `aria-label`).

`MembersPanel`: compact rows (`min-h-14`), the «Togli» button replaced by `<MemberMenu teamName={m.teamName} onRemove={() => setLeaving(...)}/>` (same `LeaveLeagueDialog` flow as today); the self row keeps «Esci dalla lega» as it is today if present.

- [ ] **Step 5: Run tests and screens**

Run: `cd frontend && npm test && npm run lint && npm run build && SIZES=1440x900,390x844,360x740 TEAMS_COUNT=11 npm run screens -- test-results/screens/gestione-4`
Expected: green; `09-lega-*`: one gold only when the field is open (none at rest), no stretched empty panel.

- [ ] **Step 6: Commit**

```bash
git add frontend
git commit -m "La lega: le aste al centro con Entra, a lato richieste, membri e inviti, Togli dentro un menu"
```

---

### Task 5: Le regole della lega sullo schema delle impostazioni

**Files:**
- Modify: `frontend/src/routes/LeagueRulesRoute.tsx`, `frontend/src/routes/LeagueRulesRoute.test.tsx`
- Modify (if needed for the grid): `frontend/src/domain/ScoringFieldset.tsx`, `frontend/src/domain/LeagueRulesFieldset.tsx`

**Interfaces:**
- Consumes: `SettingsLayout`, `SaveBar` (Task 2).

- [ ] **Step 1: Write the failing tests**

```tsx
it('usa lo schema delle impostazioni: h1, indice Sezioni, una barra di salvataggio', async () => {
  renderRules();
  expect(await screen.findByRole('heading', { level: 1, name: 'Regole della lega' })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Sezioni' })).toBeInTheDocument();
  expect(screen.getByText('Tutto salvato')).toBeInTheDocument();
});
it('cambiare un campo accende la barra; Annulla torna ai valori arrivati', async () => {
  renderRules();
  await userEvent.click(await screen.findByRole('button', { name: /aumenta.*secondi/i }));
  expect(screen.getByText('Modifiche non salvate')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Annulla' }));
  expect(screen.getByText('Tutto salvato')).toBeInTheDocument();
});
it('Salva le regole salva e torna a Tutto salvato', async () => { /* PUT called with the form; bar back to «Tutto salvato» */ });
it('un errore di salvataggio e l unico alert', async () => { /* 400 invalid-settings → exactly one role="alert" (in the bar), field errors under fields */ });
it('il punteggio: due colonne sul telefono, quattro dal contenuto largo', async () => {
  expect(screen.getByTestId('scoring-grid').className).toContain('grid-cols-2');
  expect(screen.getByTestId('scoring-grid').className).toContain('lg:grid-cols-4');
});
it('chi non puo modificare non ha la barra', async () => { /* canEdit false → no «Tutto salvato», fields read-only as today */ });
```

Use the role names of the existing stepper buttons (check `StepperField`'s `aria-label`s) — adjust the regex to the real label.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd frontend && npx vitest run src/routes/LeagueRulesRoute.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Rewrite the page on `SettingsLayout`**

- Keep `form`, `errors`, `saveError`, validation helpers and the save mutation as they are.
- `dirty = JSON.stringify(form) !== JSON.stringify(initial)` where `initial` is `{ bidder, scoring, rules }` from `rules.data`.
- `onReset = () => { setForm(initial); setErrors(NO_ERRORS); setSaveError(null); }`.
- On save success: update the cached rules (or `setForm` to the saved body and let the query refetch) so `dirty` becomes false; remove `savedMessage` (the bar's «Tutto salvato» replaces it).
- Render:

```tsx
<AppShell chrome="top" trail={trail}>
  <PageFrame>
    <SettingsLayout title="Regole della lega"
      context="Valgono per le prossime aste. Quelle già create tengono le loro."
      sections={[
        { id: 'sezione-banditore', label: 'Banditore' },
        { id: 'sezione-regole', label: 'Crediti e posti', shortLabel: 'Crediti' },
        { id: 'sezione-punteggio', label: 'Punteggio' },
      ]}
      ready={form !== null}
      saveBar={canEdit ? (
        <SaveBar dirty={dirty} pending={save.isPending} error={summary} saveLabel="Salva le regole"
          onSave={submit} onReset={reset} />
      ) : undefined}>
      {/* three <section id=… aria-labelledby=… className="panel scroll-mt-[calc(var(--header-h)+4rem)] p-5 md:p-6"> with h2 and the existing fieldsets */}
    </SettingsLayout>
  </PageFrame>
</AppShell>
```

- Delete the old in-panel index, the internal scroll container (`scrollRef`, the `md:h-[calc(100dvh…)]` frame) and the old footer save row; the loading state renders `SettingsLayout` with `ready={false}` and three section panels of the final height holding «Carico le regole della lega…» in the first.
- Scoring grid: the element wrapping the scoring inputs gets `data-testid="scoring-grid"` and `grid grid-cols-2 gap-4 lg:grid-cols-4`; labels wrap on words, never truncated.

- [ ] **Step 4: Run tests and screens**

Run: `cd frontend && npm test && npm run lint && npm run build && SIZES=1440x900,390x844,360x740 npm run screens -- test-results/screens/gestione-5`
Expected: green; `10-regole-lega-*`: no cut labels, bar at the bottom, index at the side on desktop and as a row on phone.

- [ ] **Step 5: Commit**

```bash
git add frontend
git commit -m "Le regole della lega sullo schema delle impostazioni, con una sola barra di salvataggio"
```

---

### Task 6: Le impostazioni dell'asta e il profilo sullo schema delle impostazioni

**Files:**
- Modify: `frontend/src/routes/AuctionSettingsRoute.tsx`, `frontend/src/routes/AuctionSettingsRoute.test.tsx`
- Modify: `frontend/src/routes/ProfileRoute.tsx`, `frontend/src/routes/ProfileRoute.test.tsx`

**Interfaces:**
- Consumes: `SettingsLayout`, `SaveBar` (Task 2).

- [ ] **Step 1: Write the failing tests**

`AuctionSettingsRoute.test.tsx`:

```tsx
it('una sola barra: un solo Salva per turno e banditore', async () => {
  renderSettings();
  expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Salva il turno' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Salva il banditore' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();
});
it('spostare una squadra e cambiare i secondi, poi Salva: due scritture, una pressione', async () => {
  // click «Sposta giù Real Colizzati», click stepper + on seconds, click «Salva»
  // expect PUT seats and PATCH auction both called once; bar back to «Tutto salvato»
});
it('cambiato solo il banditore, salva solo il banditore', async () => { /* only PATCH */ });
it('se una delle due scritture fallisce, la barra dice quale', async () => {
  // PUT seats 500 → alert «Il turno non è stato salvato. Riprova.»; PATCH ok
});
it('le frecce sono da 44px', async () => {
  expect(screen.getByRole('button', { name: 'Sposta giù Real Colizzati' }).className).toMatch(/size-11|min-h-11/);
});
```

(Use the real accessible names of the arrow buttons in the current file.)

`ProfileRoute.test.tsx`:

```tsx
it('sezioni Il tuo nome e Accesso nello schema delle impostazioni', async () => {
  renderProfile();
  expect(await screen.findByRole('heading', { level: 1, name: 'Il tuo profilo' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 2, name: 'Il tuo nome' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 2, name: 'Accesso' })).toBeInTheDocument();
});
it('il nome si salva dalla barra', async () => { /* type → «Modifiche non salvate» → «Salva il nome» → PATCH */ });
it('Esci sta in fondo, staccato, bottone normale', async () => {
  const esci = screen.getByRole('button', { name: 'Esci' });
  expect(esci.className).not.toContain('bg-accent');
  expect(esci.closest('[data-testid="settings-footer"]')).not.toBeNull();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd frontend && npx vitest run src/routes/AuctionSettingsRoute.test.tsx src/routes/ProfileRoute.test.tsx`
Expected: FAIL.

- [ ] **Step 3: `AuctionSettingsRoute`**

- `SettingsLayout` with title = auction name, context «Impostazioni dell'asta», sections `[{ id: 'sezione-turno', label: 'Turno di chiamata', shortLabel: 'Turno' }, { id: 'sezione-banditore', label: 'Banditore' }]`.
- `orderDirty = draft !== null`; `bidderDirty = timer !== null || beep !== null` (compare with current values; a value set back to the original is not dirty).
- `onSave`: run the needed mutations with `mutateAsync` in parallel via `Promise.allSettled`; collect failures; error message: both failed → «Turno e banditore non sono stati salvati. Riprova.»; only seats → «Il turno non è stato salvato. Riprova.»; only bidder → «Il banditore non è stato salvato. Riprova.». Successes clear their own draft.
- `onReset`: `setDraft(null); setTimer(null); setBeep(null)`.
- Locked order (auction started) keeps today's sentence and behaviour; non-admins see the read-only view without the bar.
- Rows `min-h-14`, arrow buttons `size-11`.
- Remove the separate header panel, «Salva il turno», «Salva il banditore» and the «Salvato.» status line.

- [ ] **Step 4: `ProfileRoute`**

- `SettingsLayout` title «Il tuo profilo», context = email, sections `[{ id: 'sezione-nome', label: 'Il tuo nome', shortLabel: 'Nome' }, { id: 'sezione-accesso', label: 'Accesso' }]`.
- Name section: the field only; `dirty = current !== me.data.displayName`; `SaveBar` with `saveLabel="Salva il nome"`, `onReset={() => setName(null)}`, error from `rename` when not a field error.
- Access section: email, confirmed/not confirmed sentence, «Mandami di nuovo la conferma» (`BUTTON_SECONDARY`).
- `footer`: `<div data-testid="settings-footer" className="border-t border-line pt-6">` with «Esci» (`BUTTON_SECONDARY`, not full width).

- [ ] **Step 5: Run tests and screens**

Run: `cd frontend && npm test && npm run lint && npm run build && SIZES=1440x900,390x844,360x740 TEAMS_COUNT=11 npm run screens -- test-results/screens/gestione-6`
Expected: green; `12-profilo-*` and `15-impostazioni-asta-*`: no floating boxes, one gold (the bar's save, enabled only when dirty).

- [ ] **Step 6: Commit**

```bash
git add frontend
git commit -m "Impostazioni dell'asta e profilo sullo schema delle impostazioni: un solo salvataggio, Esci in fondo"
```

---

### Task 7: L'importazione in due passaggi

**Files:**
- Create: `frontend/src/domain/FolderPicker.tsx`, `frontend/src/domain/FolderPicker.test.tsx`
- Modify: `frontend/src/routes/ImportRoute.tsx`, `frontend/src/routes/ImportRoute.test.tsx`

**Interfaces:**
- Consumes: `PageHeader` (Task 2).
- Produces: `FolderPicker({ id: string; onPick: (files: FileList) => void; picked: string | null; disabled?: boolean })`.

- [ ] **Step 1: Write the failing tests**

`FolderPicker.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FolderPicker } from './FolderPicker';

describe('FolderPicker', () => {
  it('un bottone in italiano, da 44px, e nessuna scritta del browser', () => {
    render(<FolderPicker id="f" picked={null} onPick={() => {}} />);
    const button = screen.getByRole('button', { name: 'Scegli la cartella' });
    expect(button.className).toContain('min-h-11');
    expect(screen.getByLabelText('Scegli la cartella', { selector: 'input' }).className).toContain('sr-only');
  });

  it('il bottone apre la scelta del browser', () => {
    render(<FolderPicker id="f" picked={null} onPick={() => {}} />);
    const input = screen.getByLabelText('Scegli la cartella', { selector: 'input' }) as HTMLInputElement;
    const click = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Scegli la cartella' }));
    expect(click).toHaveBeenCalled();
  });

  it('dopo la scelta dice il nome della cartella', () => {
    render(<FolderPicker id="f" picked="Asta 2025" onPick={() => {}} />);
    expect(screen.getByText('Asta 2025')).toBeInTheDocument();
  });

  it('la cartella scelta arriva a onPick', () => {
    const onPick = vi.fn();
    render(<FolderPicker id="f" picked={null} onPick={onPick} />);
    const input = screen.getByLabelText('Scegli la cartella', { selector: 'input' });
    const file = new File(['x'], 'eventi.json');
    fireEvent.change(input, { target: { files: [file] } });
    expect(onPick).toHaveBeenCalled();
  });
});
```

`ImportRoute.test.tsx` — add:

```tsx
it('due passaggi numerati, il secondo spento finche non c e una cartella', async () => {
  renderImport();
  const steps = screen.getByRole('list', { name: 'Passaggi' });
  expect(within(steps).getAllByRole('listitem').map((li) => li.textContent)).toEqual(
    [expect.stringContaining('Scegli la cartella'), expect.stringContaining('Abbina i partecipanti')]);
  expect(screen.getByTestId('import-step-2')).toHaveAttribute('aria-disabled', 'true');
});
it('prima della scelta spiega cosa deve contenere la cartella', () => {
  renderImport();
  expect(screen.getByText(/cartella di un'asta giocata con FantaAgent/)).toBeInTheDocument();
});
it('il riquadro ha da subito l altezza del passaggio piu alto', () => {
  renderImport();
  expect(screen.getByTestId('import-box').className).toContain('min-h-[34rem]');
});
it('Importa l asta e l unico oro', async () => { /* after preview: one .bg-accent */ });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd frontend && npx vitest run src/domain/FolderPicker.test.tsx src/routes/ImportRoute.test.tsx`
Expected: FAIL.

- [ ] **Step 3: `FolderPicker`**

```tsx
import { useRef } from 'react';
import { BUTTON_SECONDARY } from './controls';

/**
 * La scelta di una cartella con un bottone nostro, in italiano: il controllo del
 * browser scriverebbe «Choose Files — No file chosen». Il campo vero resta nel
 * documento, nascosto alla vista e non all'accessibilita', e il bottone lo apre.
 */
export function FolderPicker({ id, onPick, picked, disabled = false }: {
  id: string;
  onPick: (files: FileList) => void;
  picked: string | null;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <label htmlFor={id} className="sr-only">Scegli la cartella</label>
      <input ref={input} id={id} type="file" multiple disabled={disabled} className="sr-only" tabIndex={-1}
        {...{ webkitdirectory: '', directory: '' }}
        onChange={(e) => { if (e.target.files && e.target.files.length > 0) onPick(e.target.files); }} />
      <button type="button" disabled={disabled} onClick={() => input.current?.click()}
        className={`${BUTTON_SECONDARY} min-h-11 px-5`}>
        Scegli la cartella
      </button>
      <span className="text-sm text-muted-foreground">
        {picked ? <span className="font-medium text-foreground">{picked}</span> : 'Nessuna cartella scelta'}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite `ImportRoute`**

- `PageHeader` title «Importa un'asta», context «Porta qui un'asta giocata con FantaAgent sul computer.»
- One panel `data-testid="import-box"` `panel min-h-[34rem] p-5 md:p-6` (measure the tallest state with 11 participants at 1440 and set the value to it; record the measurement in the commit message), containing `<ol aria-label="Passaggi">` with two items:
  1. «Scegli la cartella»: the explanation sentence, `FolderPicker` (picked = the folder name taken from `files[0].webkitRelativePath.split('/')[0]`), then the preview line «N acquisti» or the explained error (`role="alert"`, the only one).
  2. «Abbina i partecipanti» (`data-testid="import-step-2"`, `aria-disabled` until a preview exists): the existing matching selects and «Importa l'asta» (`BUTTON_PRIMARY`).
- Keep all mutation logic as is.

- [ ] **Step 5: Run tests and screens**

Run: `cd frontend && npm test && npm run lint && npm run build && SIZES=1440x900,390x844,360x740 npm run screens -- test-results/screens/gestione-7`
Expected: green; `11-importa-*`: Italian picker, no floating small box.

- [ ] **Step 6: Commit**

```bash
git add frontend
git commit -m "L'importazione in due passaggi, con la scelta della cartella in italiano"
```

---

### Task 8: Le misure finali

**Files:**
- Modify: `frontend/scripts/screens.mjs` (only if checks are missing)
- Modify: `docs/superpowers/decisions/2026-09-30-club-notturno-fondamenta.md`

- [ ] **Step 1: Run the full screenshot set**

Run: `cd frontend && SIZES=1440x900,1920x1080,1280x720,390x844,360x740 npm run screens -- test-results/screens/gestione-finale` and again with `TEAMS_COUNT=11`.
Expected: `larghe: []`, `parole spezzate: []`; asta and proiezione shots (13*, 14*, 16*) byte-identical to a run on `main` (run the same command on `main` into `test-results/screens/gestione-base` first; differences of ≤2/255 on a few dozen pixels are antialiasing and accepted).

- [ ] **Step 2: Gold count check**

Add to `screens.mjs`, for every shot whose name starts with `08`, `09`, `10`, `11`, `12`, `15`, a count of visible elements with class `bg-accent` that are buttons or links; print `oro: [...]` listing shots where the count is greater than 1. Expected: `oro: []`.

- [ ] **Step 3: Look at every management shot at every size**

Judge each against: no big empty area in the whole page, no cut name, the save bar never covers a field, the phone index row fits without scrolling sideways. Fix what fails in the task's file, with a test.

- [ ] **Step 4: Write the notes**

Append to the decisions document a section «Le pagine di gestione — misure finali»: for each page the measured heights that were fixed in advance (MyAuctionCard `min-h-52`, join results `h-[24rem]`, import box, save bar 72px), what was measured to choose them, and any ruling taken during the plan.

- [ ] **Step 5: Commit**

```bash
git add frontend docs
git commit -m "Le pagine di gestione misurate: una sola azione oro, nessun vuoto, niente di lato"
```
