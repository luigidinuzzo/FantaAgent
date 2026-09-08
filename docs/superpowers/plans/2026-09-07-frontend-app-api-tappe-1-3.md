# App frontend e confine API — piano, tappe 1–3

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare FantaAgent ad avere un'app React separata che parla al backend
via JSON, fino alla schermata d'asta funzionante, senza smontare il frontend
Thymeleaf esistente.

**Architecture:** Monorepo. Un package nuovo `adapter/in/api` con i
`@RestController` affianca — non sostituisce — `adapter/in/web`, che continua a
rendere HTML e i cui 70 test restano la rete di sicurezza. Il frontend è
un'applicazione Vite in `frontend/`, servita in sviluppo dal suo dev server con
proxy su `/api`, e in produzione impacchettata dentro il jar. Lo stato di dominio
non entra nel browser: TanStack Query tiene una cache delle risposte, non una
copia gestita a mano.

**Tech Stack:** Java 25, Spring Boot 3.5.6, ArchUnit 1.5.0 · Vite, React,
TypeScript, Tailwind CSS v4, TanStack Query, Vitest, Testing Library, Playwright.

> shadcn/ui, TanStack Table, React Router e `lucide-react` erano previsti e **non
> sono arrivati**: una schermata sola non ha primitive condivise da possedere, una
> pagina di venticinque righe già ordinata dal server non ha bisogno di
> ordinamento e filtri, una rotta sola non ha bisogno di un router, e
> nell'interfaccia spedita non c'è nessuna icona. Sono rinvii deliberati, non
> arretrato: il costo di introdurli adesso è certo, la copertura no. Ciò che
> resta valido è il vincolo — quando la prima icona servirà, sarà un SVG e non
> un'emoji.

**Spec:** [`docs/superpowers/specs/2026-09-07-frontend-app-api-design.md`](../specs/2026-09-07-frontend-app-api-design.md)

## Perché questo piano si ferma alla tappa 3

La spec definisce sei tappe. Questo piano copre le prime tre, che insieme
producono software funzionante e verificabile: il confine API esiste, la
schermata d'asta — che *è* il prodotto — funziona sul nuovo frontend, e il
vecchio continua a girare intatto accanto.

Le tappe 4–6 (battitore e proiezione, schermate rimanenti, rimozione del
Thymeleaf) avranno il proprio piano. Non è una divisione di comodo: quelle tappe
consumano i componenti e gli hook che le tappe 1–3 definiscono, e pianificarle
adesso significherebbe inventare firme che non esistono ancora — esattamente il
tipo di piano che fallisce alla prima riga.

## Global Constraints

Valori copiati alla lettera dalla spec. Ogni task li assume.

- **Java 25**, Spring Boot **3.5.6**, Maven 3.9+. Non aggiornare nessuno dei due.
- **`adapter/in/web` non si tocca.** Nessun template, controller HTML o suo test
  viene modificato o eliminato in questo piano.
- **Nessun colore letterale nei componenti.** `bg-[#FFC24B]` e `bg-amber-400`
  sono entrambi errori. Solo token.
- **Tema unico, scuro.** I token vivono su `:root`. `.dark` è applicata alla
  radice del documento ma non ridefinisce nulla.
- **Nessuna risorsa esterna a runtime.** Font auto-ospitati via
  `@fontsource-variable/archivo`. Nessuna richiesta a Google Fonts, nessuna icona
  remota.
- **Icone SVG**, mai emoji (`lucide-react` era la libreria prevista; nei
  sotto-progetti 1–3 non è arrivata nessuna icona, quindi la dipendenza non è
  installata — il vincolo vale dalla prima icona in poi).
- **Bersagli tattili 44×44 px** minimo. Contorno di fuoco sempre visibile.
- **Movimento 150–300 ms**, solo in risposta a un'azione.
  `prefers-reduced-motion` sopprime transizioni e pulsazioni, **non** il
  countdown.
- **Un solo elemento elevato per pagina**: la scheda che decide.
- **Niente etichette in maiuscoletto spaziato** e **niente stringhe unite da
  punti mediani**.
- **Tabelle semantiche** (`<table>/<thead>/<tbody>`), mai griglie di `div`.
- Palette Campo: `background #0A1F16` · `surface #0E2A1E` · `line #FFFFFF26` ·
  `line-strong #FFFFFF40` · `foreground #F1F7F2` · `muted-foreground #87A594` ·
  `accent #FFC24B` · `on-accent #1B1400` · `positive #5FD08A` ·
  `destructive #E86A4B`.

## Due scostamenti dalla spec, deliberati

La spec dichiara il dominio invariato. Due task lo cambiano, in modo minimo, e la
ragione va letta prima di eseguirli.

1. **`AuctionEvent.PlayerPurchased` guadagna un campo `requestId` annullabile**
   (Task 8). L'idempotenza deve sopravvivere al riavvio, quindi la chiave deve
   stare nel registro, e il registro è il dominio. I log esistenti non hanno il
   campo e lo leggono come `null`, che significa "scritto prima che
   l'idempotenza esistesse".

2. **Nasce `PurchaseRejectedException extends IllegalArgumentException`**
   (Task 7), con un motivo tipizzato. La spec chiede `type` d'errore stabili, ma
   oggi `AuctionService` lancia `IllegalArgumentException` con messaggi in
   italiano: distinguerli per stringa sarebbe fragile. Estendere
   `IllegalArgumentException` invece di sostituirla è ciò che tiene in piedi i
   controller HTML esistenti senza toccarne una riga.

---

## File Structure

**Backend, nuovi:**

| File | Responsabilità |
|---|---|
| `adapter/in/api/LeagueGuard.java` | risolve e valida `{leagueId}` |
| `adapter/in/api/ApiExceptionHandler.java` | eccezioni → `application/problem+json` |
| `adapter/in/api/AuctionStateApi.java` | `GET /state` |
| `adapter/in/api/PlayerApi.java` | `GET /players`, `GET /players/{id}/valuation` |
| `adapter/in/api/PurchaseApi.java` | `POST /purchases`, `POST /purchases/{seq}/void`, `POST /phase` |
| `adapter/in/api/dto/StateDtos.java` | DTO di stato e partecipanti |
| `adapter/in/api/dto/PlayerDtos.java` | DTO di ricerca e valutazione |
| `adapter/in/api/dto/PurchaseDtos.java` | DTO di scrittura |
| `adapter/in/api/board/BoardApi.java` | `GET /board` — **nessuna valutazione** |
| `adapter/in/api/board/BoardDtos.java` | DTO della proiezione, senza campi di prezzo consigliato |
| `application/service/PurchaseRejectedException.java` | motivo tipizzato del rifiuto |

**Backend, modificati:**

| File | Modifica |
|---|---|
| `domain/auction/AuctionEvent.java` | `PlayerPurchased` guadagna `requestId` |
| `adapter/out/file/event/EventDto.java` | serializza `requestId` |
| `application/service/AuctionService.java` | idempotenza + rifiuti tipizzati |
| `architecture/ArchitectureTest.java` | regola di confidenzialità del tabellone |
| `pom.xml` | `frontend-maven-plugin` nel profilo `prod` |

**Frontend, nuovi** (sotto `frontend/`):

| File | Responsabilità |
|---|---|
| `scripts/palette.mjs` | unica fonte della palette; genera `tokens.css` |
| `src/styles/tokens.css` | **generato**, non modificare a mano |
| `src/styles/contrast.test.ts` | verifica i rapporti di contrasto |
| `src/api/client.ts` | `fetch` + traduzione di `problem+json` |
| `src/api/hooks.ts` | hook TanStack Query |
| `src/domain/PlayerDecisionCard.tsx` | la scheda col tetto |
| `src/domain/PlayerTable.tsx` | tabella semantica, scritta a mano (niente TanStack Table: ordinamento e filtri non servono a una pagina di 25 righe già ordinata dal server) |
| `src/domain/LeagueBoard.tsx` | barre segmentate per ruolo |
| `src/domain/BidPanel.tsx` | prezzo, partecipante, aggiudica |
| `src/domain/ConnectionStatus.tsx` | freschezza del dato |
| `src/routes/AuctionRoute.tsx` | composizione della schermata d'asta |
| `e2e/critical-path.spec.ts` | Playwright |

---

## Tappa 1 — Fondamenta

### Task 1: Palette generata e verificata

Prima riga di codice del progetto, e non è un componente: è la fonte unica dei
colori. La palette vive **una volta sola**, in un file JavaScript che genera il
CSS. Scriverla a mano in OKLCH dentro un foglio di stile significherebbe
convertire dieci valori a mano, sbagliarne uno, e non accorgersene mai.

**Files:**
- Create: `frontend/scripts/palette.mjs`
- Create: `frontend/src/styles/contrast.test.ts`
- Generated: `frontend/src/styles/tokens.css`

**Interfaces:**
- Produces: `PALETTE` — `Record<string, string>` da nome token a esadecimale;
  `hexToOklch(hex: string): {l,c,h}`; `contrastRatio(hexA, hexB): number`.
  Ogni task successivo usa i token per nome, mai il valore.

- [ ] **Step 1: Creare il progetto Vite**

```bash
cd /Users/luigidinuzzo/Progetti/FantaAgent
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
```

- [ ] **Step 2: Scrivere la fonte della palette**

Crea `frontend/scripts/palette.mjs`:

```js
// Unica fonte dei colori del progetto. tokens.css è generato da qui:
// modificare il CSS a mano significa perdere la modifica alla prossima build.
export const PALETTE = {
  background:         '#0A1F16',
  surface:            '#0E2A1E',
  foreground:         '#F1F7F2',
  'muted-foreground': '#87A594',
  accent:             '#FFC24B',
  'on-accent':        '#1B1400',
  positive:           '#5FD08A',
  destructive:        '#E86A4B',
};

// Le righe del campo sono bianco con alfa: restano in rgba, perché il loro
// senso è "la stessa linea, più o meno marcata", non due colori diversi.
export const LINES = {
  line:        'rgba(255,255,255,0.15)',
  'line-strong': 'rgba(255,255,255,0.25)',
};

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
}

export function hexToOklch(hex) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  const C = Math.sqrt(A * A + B * B);
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c: C, h };
}

export function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export { linearToSrgb };
```

- [ ] **Step 3: Scrivere il test di contrasto, che deve fallire**

Crea `frontend/src/styles/contrast.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PALETTE, contrastRatio, hexToOklch } from '../../scripts/palette.mjs';

// Ogni coppia che la direzione Campo mette davvero una sopra l'altra.
// 4.5:1 per il testo normale, 3:1 per il testo grande (il tetto, 76px).
const PAIRS: Array<[keyof typeof PALETTE, keyof typeof PALETTE, number]> = [
  ['foreground', 'background', 4.5],
  ['foreground', 'surface', 4.5],
  ['muted-foreground', 'background', 4.5],
  ['muted-foreground', 'surface', 4.5],
  ['accent', 'background', 3],
  ['accent', 'surface', 3],
  ['on-accent', 'accent', 4.5],
  ['positive', 'surface', 3],
  ['destructive', 'surface', 3],
];

describe('palette Campo', () => {
  it.each(PAIRS)('%s su %s raggiunge %s:1', (fg, bg, min) => {
    expect(contrastRatio(PALETTE[fg], PALETTE[bg])).toBeGreaterThanOrEqual(min);
  });

  it('tokens.css è rigenerato dalla palette corrente', () => {
    const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
    for (const [name, hex] of Object.entries(PALETTE)) {
      const { l, c, h } = hexToOklch(hex);
      const expected = `--color-${name}: oklch(${l.toFixed(4)} ${c.toFixed(4)} ${h.toFixed(2)});`;
      expect(css).toContain(expected);
    }
  });
});
```

- [ ] **Step 4: Eseguire il test e verificare che fallisca**

```bash
cd frontend && npm i -D vitest && npx vitest run src/styles/contrast.test.ts
```

Attesa: FAIL — `tokens.css` non esiste.

- [ ] **Step 5: Scrivere il generatore**

Aggiungi in fondo a `frontend/scripts/palette.mjs`:

```js
export function renderTokens() {
  const vars = Object.entries(PALETTE).map(([name, hex]) => {
    const { l, c, h } = hexToOklch(hex);
    return `  --color-${name}: oklch(${l.toFixed(4)} ${c.toFixed(4)} ${h.toFixed(2)});`;
  });
  const lines = Object.entries(LINES).map(([n, v]) => `  --color-${n}: ${v};`);
  const theme = [...Object.keys(PALETTE), ...Object.keys(LINES)]
    .map((n) => `  --color-${n}: var(--color-${n});`);
  return `/* GENERATO da scripts/palette.mjs — non modificare a mano.
   Rigenera con: npm run tokens */

:root {
${vars.join('\n')}
${lines.join('\n')}
  --font-sans: 'Archivo Variable', system-ui, sans-serif;
}

@theme inline {
${theme.join('\n')}
  --font-sans: var(--font-sans);
}
`;
}
```

Crea `frontend/scripts/write-tokens.mjs`:

```js
import { writeFileSync, mkdirSync } from 'node:fs';
import { renderTokens } from './palette.mjs';

mkdirSync(new URL('../src/styles/', import.meta.url), { recursive: true });
writeFileSync(new URL('../src/styles/tokens.css', import.meta.url), renderTokens());
console.log('tokens.css rigenerato');
```

In `frontend/package.json`, dentro `"scripts"`:

```json
"tokens": "node scripts/write-tokens.mjs",
"test": "vitest run"
```

- [ ] **Step 6: Generare ed eseguire il test**

```bash
cd frontend && npm run tokens && npx vitest run src/styles/contrast.test.ts
```

Attesa: PASS su tutte le coppie.

Se una coppia fallisce, **non allentare la soglia**: correggi l'esadecimale in
`PALETTE` e rigenera. Il candidato più probabile è `muted-foreground` su
`surface`, che è la coppia più stretta della direzione Campo.

- [ ] **Step 7: Commit**

```bash
cd /Users/luigidinuzzo/Progetti/FantaAgent
git add frontend/scripts frontend/src/styles frontend/package.json frontend/package-lock.json
git commit -m "Genera i token della direzione Campo da un'unica fonte

La palette vive in scripts/palette.mjs e tokens.css e' generato: scrivere
dieci valori OKLCH a mano significa sbagliarne uno e non accorgersene.
Il test misura i contrasti invece di fidarsi dell'occhio."
```

---

### Task 2: Tailwind, shadcn, Archivo e il guscio

**Files:**
- Modify: `frontend/vite.config.ts`
- Create: `frontend/src/index.css`, `frontend/src/AppShell.tsx`
- Create: `frontend/src/AppShell.test.tsx`
- Modify: `frontend/src/main.tsx`

**Interfaces:**
- Consumes: `src/styles/tokens.css` da Task 1.
- Produces: `<AppShell>{children}</AppShell>` — barra superiore fissa più area
  di contenuto. Accetta `slotStatus?: React.ReactNode` per lo stato di
  connessione, riempito in Task 15.

- [ ] **Step 1: Installare le dipendenze**

```bash
cd frontend
npm i tailwindcss @tailwindcss/vite @fontsource-variable/archivo lucide-react
npm i @tanstack/react-query @tanstack/react-table react-router-dom
npm i -D @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 2: Configurare Vite**

`frontend/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  // Il backend resta l'origine dei dati anche in sviluppo: nessun mock, nessuna
  // seconda verita' da tenere allineata.
  server: { proxy: { '/api': 'http://localhost:8080' } },
  test: { environment: 'jsdom', setupFiles: ['./src/setupTests.ts'], globals: true },
});
```

`frontend/src/setupTests.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Scrivere il foglio di ingresso**

`frontend/src/index.css`:

```css
@import '@fontsource-variable/archivo';
@import 'tailwindcss';
@import './styles/tokens.css';

/* Le cifre confrontate in colonna devono incolonnarsi davvero. Archivo ha le
   cifre tabulari: qui si chiedono, una volta, per tutto il progetto. */
.tnum { font-variant-numeric: tabular-nums; }

/* I tre ruoli ottenuti dall'asse di larghezza della stessa famiglia. */
.w-cond { font-stretch: 78%; }
.w-exp  { font-stretch: 118%; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 4: Scrivere il test del guscio, che deve fallire**

`frontend/src/AppShell.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShell } from './AppShell';

describe('AppShell', () => {
  it('mostra il contenuto dentro un landmark main', () => {
    render(<AppShell><p>contenuto</p></AppShell>);
    expect(screen.getByRole('main')).toHaveTextContent('contenuto');
  });

  it('espone la barra superiore come banner', () => {
    render(<AppShell><p>x</p></AppShell>);
    expect(screen.getByRole('banner')).toHaveTextContent('FantaAgent');
  });

  it('ospita lo slot di stato nella barra', () => {
    render(<AppShell slotStatus={<span>in diretta</span>}><p>x</p></AppShell>);
    expect(screen.getByRole('banner')).toHaveTextContent('in diretta');
  });
});
```

- [ ] **Step 5: Eseguire e verificare il fallimento**

```bash
cd frontend && npx vitest run src/AppShell.test.tsx
```

Attesa: FAIL — `Failed to resolve import "./AppShell"`.

- [ ] **Step 6: Scrivere il guscio**

`frontend/src/AppShell.tsx`:

```tsx
import type { ReactNode } from 'react';

export function AppShell({
  children,
  slotStatus,
}: {
  children: ReactNode;
  slotStatus?: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground font-sans">
      <header
        role="banner"
        className="flex items-center gap-4 border-b border-line-strong px-4 py-3 text-sm"
      >
        <span className="w-exp font-extrabold tracking-tight">FantaAgent</span>
        <div className="ml-auto flex items-center gap-4">{slotStatus}</div>
      </header>
      <main role="main" className="p-4">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 7: Eseguire i test**

```bash
cd frontend && npx vitest run
```

Attesa: PASS — tre test del guscio più quelli della palette.

- [ ] **Step 8: Commit**

```bash
cd /Users/luigidinuzzo/Progetti/FantaAgent
git add frontend
git commit -m "Aggiunge il guscio dell'applicazione con Tailwind e Archivo

Una sola famiglia variabile per tre ruoli: le classi w-cond e w-exp
prendono il condensato e l'esteso dall'asse di larghezza, e le cifre
tabulari native rendono superfluo un monospace."
```

---

### Task 3: La build Maven produce ancora un solo artefatto

Il README rivendica «un jar che parte e basta». La migrazione introduce un passo
di build; non deve introdurre un secondo processo da distribuire.

**Files:**
- Modify: `pom.xml`
- Create: `src/test/java/com/fantaagent/architecture/BuildProfileTest.java`

**Interfaces:**
- Produces: profilo Maven `prod` che esegue la build di Vite e copia `dist/` in
  `target/classes/static/`. `mvn test` senza profilo non tocca il frontend.

- [ ] **Step 1: Scrivere il test che protegge lo sviluppo veloce**

`src/test/java/com/fantaagent/architecture/BuildProfileTest.java`:

```java
package com.fantaagent.architecture;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La build del frontend deve stare in un profilo, non nel ciclo di vita di
 * default. Senza questo vincolo ogni {@code mvn test} pagherebbe una build npm,
 * e chi lavora sul backend smetterebbe di eseguire i test.
 */
class BuildProfileTest {

    @Test
    void frontendBuildIsConfinedToTheProdProfile() throws Exception {
        String pom = Files.readString(Path.of("pom.xml"));

        assertThat(pom)
                .as("il plugin del frontend deve esistere")
                .contains("frontend-maven-plugin");

        int profilesStart = pom.indexOf("<profiles>");
        assertThat(profilesStart)
                .as("il pom deve dichiarare dei profili")
                .isGreaterThan(-1);
        assertThat(pom.indexOf("frontend-maven-plugin"))
                .as("il plugin del frontend deve stare dentro <profiles>")
                .isGreaterThan(profilesStart);
    }
}
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

```bash
mvn -q test -Dtest=BuildProfileTest
```

Attesa: FAIL — «il plugin del frontend deve esistere».

- [ ] **Step 3: Aggiungere il profilo al pom**

Inserisci in `pom.xml` subito dopo la chiusura di `</build>`:

```xml
  <profiles>
    <profile>
      <id>prod</id>
      <build>
        <plugins>
          <plugin>
            <groupId>com.github.eirslett</groupId>
            <artifactId>frontend-maven-plugin</artifactId>
            <version>1.15.1</version>
            <configuration>
              <workingDirectory>frontend</workingDirectory>
              <nodeVersion>v22.11.0</nodeVersion>
            </configuration>
            <executions>
              <execution>
                <id>install-node-and-npm</id>
                <goals><goal>install-node-and-npm</goal></goals>
                <phase>generate-resources</phase>
              </execution>
              <execution>
                <id>npm-ci</id>
                <goals><goal>npm</goal></goals>
                <phase>generate-resources</phase>
                <configuration><arguments>ci</arguments></configuration>
              </execution>
              <execution>
                <id>npm-build</id>
                <goals><goal>npm</goal></goals>
                <phase>generate-resources</phase>
                <configuration><arguments>run build</arguments></configuration>
              </execution>
            </executions>
          </plugin>
          <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-resources-plugin</artifactId>
            <executions>
              <execution>
                <id>copy-frontend</id>
                <phase>process-resources</phase>
                <goals><goal>copy-resources</goal></goals>
                <configuration>
                  <outputDirectory>${project.build.outputDirectory}/static</outputDirectory>
                  <resources>
                    <resource><directory>frontend/dist</directory></resource>
                  </resources>
                </configuration>
              </execution>
            </executions>
          </plugin>
        </plugins>
      </build>
    </profile>
  </profiles>
```

- [ ] **Step 4: Eseguire il test**

```bash
mvn -q test -Dtest=BuildProfileTest
```

Attesa: PASS.

- [ ] **Step 5: Verificare che la build di produzione funzioni davvero**

```bash
mvn -q -Pprod package -DskipTests && \
  unzip -l target/fanta-agent-0.1.0-SNAPSHOT.jar | grep -c 'BOOT-INF/classes/static/index.html'
```

Attesa: `1`. Se è `0`, il frontend non è finito nel jar e il profilo va corretto
prima di proseguire.

- [ ] **Step 6: Verificare che lo sviluppo resti veloce**

```bash
time mvn -q test -Dtest=BuildProfileTest
```

Attesa: nessun download di Node, nessuna esecuzione di npm nell'output.

- [ ] **Step 7: Aggiungere `frontend/dist` e `frontend/node_modules` a .gitignore**

```bash
printf '\n# Frontend\nfrontend/node_modules/\nfrontend/dist/\n' >> .gitignore
```

- [ ] **Step 8: Commit**

```bash
git add pom.xml .gitignore src/test/java/com/fantaagent/architecture/BuildProfileTest.java
git commit -m "Impacchetta il frontend nel jar, ma solo nel profilo prod

Un artefatto solo da distribuire, come prima. Il profilo tiene la build
npm fuori da mvn test: un test che costa una build npm e' un test che
smette di essere eseguito, e BuildProfileTest lo impedisce."
```

---

## Tappa 2 — Il confine

### Task 4: `GET /state`, con la guardia della lega e gli errori tipizzati

Il primo endpoint porta con sé l'infrastruttura che tutti gli altri useranno: la
risoluzione di `{leagueId}` e il formato d'errore. Stanno in questo task e non in
uno proprio perché da soli non sono verificabili — un gestore di eccezioni senza
un endpoint che le sollevi non si può provare.

**Files:**
- Create: `src/main/java/com/fantaagent/adapter/in/api/LeagueGuard.java`
- Create: `src/main/java/com/fantaagent/adapter/in/api/UnknownLeagueException.java`
- Create: `src/main/java/com/fantaagent/adapter/in/api/ApiExceptionHandler.java`
- Create: `src/main/java/com/fantaagent/adapter/in/api/AuctionStateApi.java`
- Create: `src/main/java/com/fantaagent/adapter/in/api/dto/StateDtos.java`
- Test: `src/test/java/com/fantaagent/adapter/in/api/AuctionStateApiTest.java`

**Interfaces:**
- Consumes: `AuctionService.state()`, `.participants()`, `.auctionId()`,
  `.salesInCurrentPhase(AuctionState)`; `AuctionRuntime.currentAuctionLabel()`.
- Produces:
  - `LeagueGuard.check(String leagueId)` — lancia `UnknownLeagueException` se non
    è la lega configurata. Ogni endpoint successivo lo chiama per primo.
  - `StateDtos.AuctionStateResponse` e `StateDtos.ParticipantView`.
  - `ApiExceptionHandler`, a cui i task successivi aggiungono gestori.

- [ ] **Step 1: Scrivere il test, che deve fallire**

`src/test/java/com/fantaagent/adapter/in/api/AuctionStateApiTest.java`:

```java
package com.fantaagent.adapter.in.api;

import com.fantaagent.application.service.AuctionRuntime;
import com.fantaagent.application.service.AuctionService;
import com.fantaagent.application.service.NoAuctionSelectedException;
import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.auction.Holding;
import com.fantaagent.domain.auction.Squad;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;
import java.util.Map;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
class AuctionStateApiTest {

    private static final LeagueRules RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 2, Role.C, 1, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static final List<Participant> PARTICIPANTS = List.of(
            new Participant("anna", "Anna", 'A', true),
            new Participant("bruno", "Bruno", 'B', false));

    private static final Holding BASTONI = new Holding(1, "d1", Role.D, "anna", 20);

    private static final AuctionState STATE = new AuctionState(RULES, Role.D, "anna",
            Map.of("anna", new Squad("anna", List.of(BASTONI), RULES),
                   "bruno", new Squad("bruno", List.of(), RULES)),
            List.of(BASTONI));

    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private AuctionService auction;

    @MockitoBean
    private AuctionRuntime runtime;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
        when(auction.state()).thenReturn(STATE);
        when(auction.participants()).thenReturn(PARTICIPANTS);
        when(auction.auctionId()).thenReturn("2026-09-07");
        when(auction.salesInCurrentPhase(STATE)).thenReturn(1);
        when(runtime.currentAuctionLabel()).thenReturn("Asta di prova");
    }

    @Test
    void statePortaFaseBudgetESlotDiOgniPartecipante() throws Exception {
        mvc.perform(get("/api/leagues/default/auctions/2026-09-07/state"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.auctionId").value("2026-09-07"))
                .andExpect(jsonPath("$.auctionName").value("Asta di prova"))
                .andExpect(jsonPath("$.currentPhase").value("D"))
                .andExpect(jsonPath("$.phases").value(List.of("P", "D", "C", "A")))
                .andExpect(jsonPath("$.soldInPhase").value(1))
                .andExpect(jsonPath("$.myParticipantId").value("anna"))
                .andExpect(jsonPath("$.canUndo").value(true))
                .andExpect(jsonPath("$.participants[0].id").value("anna"))
                .andExpect(jsonPath("$.participants[0].me").value(true))
                .andExpect(jsonPath("$.participants[0].budgetRemaining").value(80))
                .andExpect(jsonPath("$.participants[0].filledByRole.D").value(1))
                .andExpect(jsonPath("$.participants[0].slotsByRole.D").value(2))
                .andExpect(jsonPath("$.participants[1].budgetRemaining").value(100));
    }

    @Test
    void legaSconosciutaRisponde404InFormatoProblem() throws Exception {
        mvc.perform(get("/api/leagues/inesistente/auctions/2026-09-07/state"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.type")
                        .value("https://fantaagent.local/problems/unknown-league"));
    }

    @Test
    void nessunaAstaSceltaRisponde409InFormatoProblem() throws Exception {
        when(auction.state()).thenThrow(new NoAuctionSelectedException());

        mvc.perform(get("/api/leagues/default/auctions/2026-09-07/state"))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.type")
                        .value("https://fantaagent.local/problems/no-auction-selected"));
    }
}
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

```bash
mvn -q test -Dtest=AuctionStateApiTest
```

Attesa: FAIL — 404 su tutte e tre, nessun controller mappa quelle rotte.

- [ ] **Step 3: Scrivere la guardia della lega**

`src/main/java/com/fantaagent/adapter/in/api/UnknownLeagueException.java`:

```java
package com.fantaagent.adapter.in.api;

public class UnknownLeagueException extends RuntimeException {

    public UnknownLeagueException(String leagueId) {
        super("nessuna lega con identificativo " + leagueId);
    }
}
```

`src/main/java/com/fantaagent/adapter/in/api/LeagueGuard.java`:

```java
package com.fantaagent.adapter.in.api;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Risolve il segmento {@code {leagueId}} delle rotte.
 *
 * <p>In questo sotto-progetto esiste una lega sola, e questa classe si limita a
 * rifiutare gli altri identificativi. Esiste comunque, e viene chiamata da ogni
 * endpoint, perche' e' il punto in cui il sotto-progetto 2 innestera' la
 * risoluzione vera senza toccare un solo controller: un 404 che oggi arriva da un
 * confronto di stringhe domani arrivera' da una query, e il frontend non se ne
 * accorgera'.
 */
@Component
public class LeagueGuard {

    private final String leagueId;

    public LeagueGuard(@Value("${fantaagent.league-id:default}") String leagueId) {
        this.leagueId = leagueId;
    }

    public void check(String candidate) {
        if (!leagueId.equals(candidate)) {
            throw new UnknownLeagueException(candidate);
        }
    }
}
```

- [ ] **Step 4: Scrivere il gestore degli errori**

`src/main/java/com/fantaagent/adapter/in/api/ApiExceptionHandler.java`:

```java
package com.fantaagent.adapter.in.api;

import com.fantaagent.application.service.NoAuctionSelectedException;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;

/**
 * Traduce le eccezioni dell'applicazione in RFC 9457.
 *
 * <p>Limitato al package dell'API: {@code NoAuctionAdvice} continua a servire i
 * controller HTML rimandando alla home, che su un'API non avrebbe senso.
 */
@RestControllerAdvice(basePackages = "com.fantaagent.adapter.in.api")
public class ApiExceptionHandler {

    static final String TYPE_BASE = "https://fantaagent.local/problems/";

    @ExceptionHandler(UnknownLeagueException.class)
    ProblemDetail unknownLeague(UnknownLeagueException e) {
        return problem(HttpStatus.NOT_FOUND, "unknown-league", e.getMessage());
    }

    @ExceptionHandler(NoAuctionSelectedException.class)
    ProblemDetail noAuction(NoAuctionSelectedException e) {
        return problem(HttpStatus.CONFLICT, "no-auction-selected",
                "Nessuna asta è aperta. Scegline una dalla home.");
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ProblemDetail invalid(IllegalArgumentException e) {
        return problem(HttpStatus.UNPROCESSABLE_ENTITY, "invalid-request", e.getMessage());
    }

    static ProblemDetail problem(HttpStatusCode status, String slug, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setType(URI.create(TYPE_BASE + slug));
        return problem;
    }
}
```

- [ ] **Step 5: Scrivere i DTO di stato**

`src/main/java/com/fantaagent/adapter/in/api/dto/StateDtos.java`:

```java
package com.fantaagent.adapter.in.api.dto;

import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.auction.Squad;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Role;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class StateDtos {

    private StateDtos() {
    }

    /**
     * Un partecipante come lo vede il tabellone: quanto gli resta e quanto ha
     * riempito, ruolo per ruolo.
     *
     * <p>Le due mappe viaggiano separate invece di una stringa gia' composta:
     * la composizione della rosa e' una barra segmentata, e comporre
     * "1P 3D 0C 0A" qui significherebbe costringere l'interfaccia a
     * scomporla di nuovo per disegnarla.
     */
    public record ParticipantView(String id, String name, String initial, boolean me,
                                  int budgetRemaining, int slotsRemaining,
                                  Map<Role, Integer> filledByRole,
                                  Map<Role, Integer> slotsByRole) {
    }

    public record AuctionStateResponse(String auctionId, String auctionName,
                                       Role currentPhase, List<Role> phases,
                                       int soldInPhase, String myParticipantId,
                                       boolean canUndo,
                                       List<ParticipantView> participants) {
    }

    public static AuctionStateResponse from(String auctionId, String auctionName,
                                            AuctionState state, List<Participant> participants,
                                            int soldInPhase) {
        List<ParticipantView> views = participants.stream()
                .map(p -> view(p, state.squadOf(p.id()), state))
                .toList();
        return new AuctionStateResponse(auctionId, auctionName, state.currentPhase(),
                state.rules().phases(), soldInPhase, state.myParticipantId(),
                !state.holdings().isEmpty(), views);
    }

    private static ParticipantView view(Participant p, Squad squad, AuctionState state) {
        Map<Role, Integer> filled = new LinkedHashMap<>();
        Map<Role, Integer> total = new LinkedHashMap<>();
        for (Role role : Role.values()) {
            filled.put(role, squad.count(role));
            total.put(role, state.rules().slots(role));
        }
        return new ParticipantView(p.id(), p.name(), String.valueOf(p.initial()), p.me(),
                squad.budgetRemaining(), squad.slotsRemaining(), filled, total);
    }
}
```

- [ ] **Step 6: Scrivere il controller**

`src/main/java/com/fantaagent/adapter/in/api/AuctionStateApi.java`:

```java
package com.fantaagent.adapter.in.api;

import com.fantaagent.adapter.in.api.dto.StateDtos;
import com.fantaagent.application.service.AuctionRuntime;
import com.fantaagent.application.service.AuctionService;
import com.fantaagent.domain.auction.AuctionState;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/leagues/{leagueId}/auctions/{auctionId}")
public class AuctionStateApi {

    private final LeagueGuard leagues;
    private final AuctionService auction;
    private final AuctionRuntime runtime;

    public AuctionStateApi(LeagueGuard leagues, AuctionService auction, AuctionRuntime runtime) {
        this.leagues = leagues;
        this.auction = auction;
        this.runtime = runtime;
    }

    @GetMapping("/state")
    public StateDtos.AuctionStateResponse state(@PathVariable String leagueId,
                                                @PathVariable String auctionId) {
        leagues.check(leagueId);
        // Una sola lettura dello stato per richiesta: rileggerlo per il conteggio
        // dei venduti rifolderebbe il log e potrebbe rispondere su due stati
        // diversi dentro la stessa risposta.
        AuctionState state = auction.state();
        return StateDtos.from(auction.auctionId(), runtime.currentAuctionLabel(),
                state, auction.participants(), auction.salesInCurrentPhase(state));
    }
}
```

- [ ] **Step 7: Eseguire il test**

```bash
mvn -q test -Dtest=AuctionStateApiTest
```

Attesa: PASS, tre test.

- [ ] **Step 8: Verificare che il frontend Thymeleaf non si sia rotto**

```bash
mvn -q test
```

Attesa: PASS, tutta la suite. Se qualcosa fallisce in `adapter/in/web`, il nuovo
`@RestControllerAdvice` sta intercettando anche i controller HTML: controlla il
`basePackages`.

- [ ] **Step 9: Commit**

```bash
git add src/main/java/com/fantaagent/adapter/in/api src/test/java/com/fantaagent/adapter/in/api
git commit -m "Apre il confine API con lo stato dell'asta

Le URL nascono gia' nella forma /api/leagues/{id}/auctions/{id}: dietro
c'e' una lega sola e LeagueGuard la verifica con un confronto di stringhe,
ma e' il punto in cui il sotto-progetto 2 innestera' la risoluzione vera
senza toccare un controller ne' una riga di frontend.

Gli errori escono in RFC 9457. L'advice e' limitato al package dell'API:
NoAuctionAdvice continua a rimandare alla home per le pagine HTML."
```

---

### Task 5: Ricerca, tabella di fase e valutazione

**Files:**
- Create: `src/main/java/com/fantaagent/adapter/in/api/PlayerApi.java`
- Create: `src/main/java/com/fantaagent/adapter/in/api/dto/PlayerDtos.java`
- Test: `src/test/java/com/fantaagent/adapter/in/api/PlayerApiTest.java`

**Interfaces:**
- Consumes: `PlayerSearchService.search(String)`,
  `.phasePlayers(int offset, int limit)` che ritorna `PhasePage`;
  `PlayerAnalysisService.analyze(String playerId)` che ritorna
  `PriceRecommendation`; `PlayerCatalog.byId(String)`.
- Produces: `PlayerDtos.PlayerSummary`, `.ValuationResponse`, `.PhaseRowView`,
  `.PhasePageResponse`.

- [ ] **Step 1: Scrivere il test, che deve fallire**

`src/test/java/com/fantaagent/adapter/in/api/PlayerApiTest.java`:

```java
package com.fantaagent.adapter.in.api;

import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.application.service.PlayerAnalysisService;
import com.fantaagent.application.service.PlayerSearchService;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.PlayerProjection;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.strategy.ConfidenceScore;
import com.fantaagent.domain.strategy.Driver;
import com.fantaagent.domain.strategy.PriceRecommendation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
class PlayerApiTest {

    private static final Player BASTONI = new Player("d1", "Bastoni", "Inter", Role.D, 20);

    private static final PriceRecommendation RECOMMENDATION = new PriceRecommendation(
            "d1", 38, 47, 90, 9,
            "oltre 47 il completamento perde più di quanto guadagni",
            ConfidenceScore.of(0.9, 0.9, 0.6, 0.9),
            List.of(new Driver("budget", 3.0, "budget capiente")));

    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private PlayerSearchService search;

    @MockitoBean
    private PlayerAnalysisService analysis;

    @MockitoBean
    private PlayerCatalog catalog;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
        when(catalog.byId("d1")).thenReturn(Optional.of(BASTONI));
        when(search.search("bast")).thenReturn(List.of(BASTONI));
        when(analysis.analyze("d1")).thenReturn(RECOMMENDATION);
    }

    @Test
    void laRicercaRestituisceIGiocatoriConLaQuotazione() throws Exception {
        mvc.perform(get("/api/leagues/default/auctions/a1/players?q=bast"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("d1"))
                .andExpect(jsonPath("$[0].name").value("Bastoni"))
                .andExpect(jsonPath("$[0].team").value("Inter"))
                .andExpect(jsonPath("$[0].role").value("D"))
                .andExpect(jsonPath("$[0].listPrice").value(20));
    }

    @Test
    void laValutazionePortaTettoMargineEDriver() throws Exception {
        mvc.perform(get("/api/leagues/default/auctions/a1/players/d1/valuation"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.playerId").value("d1"))
                .andExpect(jsonPath("$.name").value("Bastoni"))
                .andExpect(jsonPath("$.maxBid").value(47))
                .andExpect(jsonPath("$.expectedPrice").value(38))
                .andExpect(jsonPath("$.margin").value(9))
                .andExpect(jsonPath("$.worthPursuing").value(true))
                .andExpect(jsonPath("$.confidenceStars").value(RECOMMENDATION.confidence().stars()))
                .andExpect(jsonPath("$.drivers[0].label").value("budget"));
    }

    @Test
    void laTabellaDiFasePortaOffsetETotale() throws Exception {
        // (playerId, role, expectedRating, bonusPerAppearance, expectedAppearances,
        //  basePoints, observedAppearances) — 30 presenze attese su 38 giornate
        //  danno una titolarita' di circa il 79%.
        PlayerProjection projection =
                new PlayerProjection("d1", Role.D, 6.2, 0.5, 30.0, 120.0, 25.0);
        when(search.phasePlayers(anyInt(), anyInt())).thenReturn(
                new PlayerSearchService.PhasePage(
                        List.of(new PlayerSearchService.PhaseRow(BASTONI, RECOMMENDATION, projection)),
                        0, 25, 1));

        mvc.perform(get("/api/leagues/default/auctions/a1/players/phase?offset=0&limit=25"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.offset").value(0))
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.rows[0].id").value("d1"))
                .andExpect(jsonPath("$.rows[0].maxBid").value(47));
    }
}
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

```bash
mvn -q test -Dtest=PlayerApiTest
```

Attesa: FAIL — 404 su tutte e tre le rotte.

- [ ] **Step 3: Scrivere i DTO**

`src/main/java/com/fantaagent/adapter/in/api/dto/PlayerDtos.java`:

```java
package com.fantaagent.adapter.in.api.dto;

import com.fantaagent.application.service.PlayerSearchService;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.strategy.PriceRecommendation;

import java.util.List;

public final class PlayerDtos {

    private PlayerDtos() {
    }

    public record PlayerSummary(String id, String name, String team, Role role, int listPrice) {

        public static PlayerSummary from(Player p) {
            return new PlayerSummary(p.id(), p.name(), p.team(), p.role(), p.listPrice());
        }
    }

    public record DriverView(String label, double contribution, String explanation) {
    }

    /**
     * {@code worthPursuing} viaggia calcolato invece di lasciare che sia
     * l'interfaccia a confrontare margine e tetto: la regola "prendi o lascia"
     * appartiene al dominio, e riscriverla in TypeScript significherebbe avere
     * due versioni della stessa decisione che possono divergere.
     */
    public record ValuationResponse(String playerId, String name, String team, Role role,
                                    int listPrice, int expectedPrice, int maxBid, int hardCap,
                                    int margin, String walkAwayReason, boolean worthPursuing,
                                    int confidenceStars, List<DriverView> drivers) {

        public static ValuationResponse from(Player player, PriceRecommendation r) {
            return new ValuationResponse(player.id(), player.name(), player.team(),
                    player.role(), player.listPrice(), r.expectedPrice(), r.maxBid(),
                    r.hardCap(), r.margin(), r.walkAwayReason(), r.worthPursuing(),
                    r.confidence().stars(),
                    r.drivers().stream()
                            .map(d -> new DriverView(d.label(), d.contribution(), d.explanation()))
                            .toList());
        }
    }

    public record PhaseRowView(String id, String name, String team, Role role, int listPrice,
                               int maxBid, int expectedPrice, int margin,
                               double fantamediaAttesa, double titolaritaPercent) {

        public static PhaseRowView from(PlayerSearchService.PhaseRow row) {
            Player p = row.player();
            PriceRecommendation r = row.recommendation();
            return new PhaseRowView(p.id(), p.name(), p.team(), p.role(), p.listPrice(),
                    r.maxBid(), r.expectedPrice(), r.margin(),
                    row.fantamediaAttesa(), row.titolaritaPercent());
        }
    }

    public record PhasePageResponse(List<PhaseRowView> rows, int offset, int pageSize,
                                    int total, boolean hasPrevious, boolean hasNext) {

        public static PhasePageResponse from(PlayerSearchService.PhasePage page) {
            return new PhasePageResponse(page.rows().stream().map(PhaseRowView::from).toList(),
                    page.offset(), page.pageSize(), page.total(),
                    page.hasPrevious(), page.hasNext());
        }
    }
}
```

- [ ] **Step 4: Scrivere il controller**

`src/main/java/com/fantaagent/adapter/in/api/PlayerApi.java`:

```java
package com.fantaagent.adapter.in.api;

import com.fantaagent.adapter.in.api.dto.PlayerDtos;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.application.service.PlayerAnalysisService;
import com.fantaagent.application.service.PlayerSearchService;
import com.fantaagent.domain.player.Player;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/leagues/{leagueId}/auctions/{auctionId}/players")
public class PlayerApi {

    private final LeagueGuard leagues;
    private final PlayerSearchService search;
    private final PlayerAnalysisService analysis;
    private final PlayerCatalog catalog;

    public PlayerApi(LeagueGuard leagues, PlayerSearchService search,
                     PlayerAnalysisService analysis, PlayerCatalog catalog) {
        this.leagues = leagues;
        this.search = search;
        this.analysis = analysis;
        this.catalog = catalog;
    }

    @GetMapping
    public List<PlayerDtos.PlayerSummary> search(@PathVariable String leagueId,
                                                 @RequestParam(defaultValue = "") String q) {
        leagues.check(leagueId);
        return search.search(q).stream().map(PlayerDtos.PlayerSummary::from).toList();
    }

    @GetMapping("/phase")
    public PlayerDtos.PhasePageResponse phase(
            @PathVariable String leagueId,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "25") int limit) {
        leagues.check(leagueId);
        return PlayerDtos.PhasePageResponse.from(search.phasePlayers(offset, limit));
    }

    @GetMapping("/{playerId}/valuation")
    public PlayerDtos.ValuationResponse valuation(@PathVariable String leagueId,
                                                  @PathVariable String playerId) {
        leagues.check(leagueId);
        Player player = catalog.byId(playerId)
                .orElseThrow(() -> new UnknownPlayerException(playerId));
        return PlayerDtos.ValuationResponse.from(player, analysis.analyze(playerId));
    }
}
```

`src/main/java/com/fantaagent/adapter/in/api/UnknownPlayerException.java`:

```java
package com.fantaagent.adapter.in.api;

public class UnknownPlayerException extends RuntimeException {

    public UnknownPlayerException(String playerId) {
        super("nessun giocatore con identificativo " + playerId);
    }
}
```

- [ ] **Step 5: Aggiungere il gestore del giocatore sconosciuto**

In `ApiExceptionHandler`, sopra il gestore di `IllegalArgumentException`:

```java
    @ExceptionHandler(UnknownPlayerException.class)
    ProblemDetail unknownPlayer(UnknownPlayerException e) {
        return problem(HttpStatus.NOT_FOUND, "unknown-player", e.getMessage());
    }
```

- [ ] **Step 6: Eseguire i test**

```bash
mvn -q test -Dtest=PlayerApiTest && mvn -q test
```

Attesa: PASS in entrambi i casi.

- [ ] **Step 7: Commit**

```bash
git add src/main/java/com/fantaagent/adapter/in/api src/test/java/com/fantaagent/adapter/in/api
git commit -m "Espone ricerca, tabella di fase e valutazione

worthPursuing viaggia calcolato dal dominio invece di essere riderivato
in TypeScript: la regola prendi-o-lascia esiste in un posto solo."
```

---

### Task 6: Rifiuti d'acquisto tipizzati

Oggi `recordPurchase` lancia `IllegalArgumentException` con messaggi in italiano.
Distinguerli per stringa nell'API sarebbe fragile — cambiare una parola nel
messaggio cambierebbe il comportamento del frontend.

**La nuova eccezione estende `IllegalArgumentException`:** i controller HTML
esistenti e i loro test continuano a catturarla esattamente come prima, e non va
modificata una riga di `adapter/in/web`.

**Files:**
- Create: `src/main/java/com/fantaagent/application/service/PurchaseRejectedException.java`
- Modify: `src/main/java/com/fantaagent/application/service/AuctionService.java`
- Modify: `src/main/java/com/fantaagent/adapter/in/api/ApiExceptionHandler.java`
- Test: `src/test/java/com/fantaagent/application/service/PurchaseRejectionTest.java`

**Interfaces:**
- Produces: `PurchaseRejectedException` con `Reason` fra
  `ALREADY_SOLD`, `INSUFFICIENT_BUDGET`, `ROLE_SLOTS_EXHAUSTED`, e
  `.reason()`. Il Task 7 la solleva anche per l'idempotenza.

- [ ] **Step 1: Scrivere il test, che deve fallire**

`src/test/java/com/fantaagent/application/service/PurchaseRejectionTest.java`:

```java
package com.fantaagent.application.service;

import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PurchaseRejectionTest {

    private static final LeagueRules RULES = new LeagueRules(2, 30,
            Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static final Player BASTONI = new Player("d1", "Bastoni", "Inter", Role.D, 20);
    private static final Player DIMARCO = new Player("d2", "Dimarco", "Inter", Role.D, 18);

    private AuctionService service() {
        PlayerCatalog catalog = new PlayerCatalog() {
            @Override
            public Optional<Player> byId(String id) {
                return List.of(BASTONI, DIMARCO).stream().filter(p -> p.id().equals(id)).findFirst();
            }

            @Override
            public List<Player> all() {
                return List.of(BASTONI, DIMARCO);
            }
        };
        return new AuctionService(RULES,
                List.of(new Participant("anna", "Anna", 'A', true),
                        new Participant("bruno", "Bruno", 'B', false)),
                catalog, new InMemoryEventStore());
    }

    @Test
    void giocatoreGiaVendutoPortaIlMotivoAlreadySold() {
        AuctionService service = service();
        service.recordPurchase("d1", "anna", 5);

        assertThatThrownBy(() -> service.recordPurchase("d1", "bruno", 5))
                .isInstanceOf(PurchaseRejectedException.class)
                .isInstanceOf(IllegalArgumentException.class)
                .extracting(e -> ((PurchaseRejectedException) e).reason())
                .isEqualTo(PurchaseRejectedException.Reason.ALREADY_SOLD);
    }

    @Test
    void budgetInsufficientePortaIlMotivoInsufficientBudget() {
        assertThatThrownBy(() -> service().recordPurchase("d1", "anna", 999))
                .isInstanceOf(PurchaseRejectedException.class)
                .extracting(e -> ((PurchaseRejectedException) e).reason())
                .isEqualTo(PurchaseRejectedException.Reason.INSUFFICIENT_BUDGET);
    }

    @Test
    void slotDiRuoloEsauritiPortaIlMotivoRoleSlotsExhausted() {
        AuctionService service = service();
        service.recordPurchase("d1", "anna", 5);

        assertThatThrownBy(() -> service.recordPurchase("d2", "anna", 5))
                .isInstanceOf(PurchaseRejectedException.class)
                .extracting(e -> ((PurchaseRejectedException) e).reason())
                .isEqualTo(PurchaseRejectedException.Reason.ROLE_SLOTS_EXHAUSTED);
    }

    @Test
    void ilMessaggioRestaQuelloDiPrima() {
        assertThatThrownBy(() -> service().recordPurchase("d1", "anna", 999))
                .hasMessageContaining("Anna")
                .hasMessageContaining("crediti");
    }
}
```

`InMemoryEventStore` esiste già fra i test? Verificalo con
`grep -rl "class InMemoryEventStore" src/test`. Se non c'è, creane uno in
`src/test/java/com/fantaagent/application/service/InMemoryEventStore.java`:

```java
package com.fantaagent.application.service;

import com.fantaagent.application.port.out.AuctionEventStore;
import com.fantaagent.domain.auction.AuctionEvent;

import java.util.ArrayList;
import java.util.List;

class InMemoryEventStore implements AuctionEventStore {

    private final List<AuctionEvent> events = new ArrayList<>();

    @Override
    public void append(AuctionEvent event) {
        events.add(event);
    }

    @Override
    public List<AuctionEvent> load() {
        return List.copyOf(events);
    }

    @Override
    public long nextSeq() {
        return events.size() + 1L;
    }

    @Override
    public void backup(String label) {
    }
}
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

```bash
mvn -q test -Dtest=PurchaseRejectionTest
```

Attesa: FAIL — `PurchaseRejectedException` non esiste.

- [ ] **Step 3: Scrivere l'eccezione**

`src/main/java/com/fantaagent/application/service/PurchaseRejectedException.java`:

```java
package com.fantaagent.application.service;

/**
 * Un acquisto rifiutato, col motivo in forma tipizzata.
 *
 * <p><b>Estende {@link IllegalArgumentException} di proposito.</b> I controller
 * HTML esistenti catturano quella, e sostituirla imporrebbe di modificarli tutti
 * insieme al resto — cioe' di toccare la rete di sicurezza proprio mentre serve.
 * Estendendola, il comportamento vecchio resta identico e l'API guadagna il
 * motivo di cui ha bisogno per emettere un {@code type} stabile.
 */
public class PurchaseRejectedException extends IllegalArgumentException {

    public enum Reason {
        ALREADY_SOLD,
        INSUFFICIENT_BUDGET,
        ROLE_SLOTS_EXHAUSTED
    }

    private final transient Reason reason;

    public PurchaseRejectedException(Reason reason, String message) {
        super(message);
        this.reason = reason;
    }

    public Reason reason() {
        return reason;
    }
}
```

- [ ] **Step 4: Sollevarla da `AuctionService`**

In `AuctionService.recordPurchase`, sostituisci i tre `throw` di validazione
lasciando i messaggi **identici**:

```java
        if (current.soldPlayerIds().contains(playerId)) {
            throw new PurchaseRejectedException(PurchaseRejectedException.Reason.ALREADY_SOLD,
                    player.name() + " è già stato acquistato");
        }
        Squad squad = current.squadOf(buyer.id());
        if (price > squad.budgetRemaining()) {
            throw new PurchaseRejectedException(
                    PurchaseRejectedException.Reason.INSUFFICIENT_BUDGET,
                    buyer.name() + " ha solo " + squad.budgetRemaining()
                    + " crediti di budget residuo");
        }
        if (!squad.hasRoom(player.role())) {
            throw new PurchaseRejectedException(
                    PurchaseRejectedException.Reason.ROLE_SLOTS_EXHAUSTED,
                    buyer.name() + " ha già coperto tutti gli slot " + player.role());
        }
```

I `throw` per giocatore sconosciuto, partecipante sconosciuto e prezzo minore di
1 restano `IllegalArgumentException`: non sono rifiuti di dominio ma richieste
malformate, e l'API li mappa già su `invalid-request`.

- [ ] **Step 5: Aggiungere il gestore all'API**

In `ApiExceptionHandler`, **sopra** il gestore di `IllegalArgumentException` —
l'ordine conta, perché la nuova eccezione ne è una sottoclasse:

```java
    @ExceptionHandler(PurchaseRejectedException.class)
    ProblemDetail rejected(PurchaseRejectedException e) {
        HttpStatus status = e.reason() == PurchaseRejectedException.Reason.ALREADY_SOLD
                ? HttpStatus.CONFLICT
                : HttpStatus.UNPROCESSABLE_ENTITY;
        return problem(status, slug(e.reason()), e.getMessage());
    }

    private static String slug(PurchaseRejectedException.Reason reason) {
        return switch (reason) {
            case ALREADY_SOLD -> "player-already-sold";
            case INSUFFICIENT_BUDGET -> "insufficient-budget";
            case ROLE_SLOTS_EXHAUSTED -> "role-slots-exhausted";
        };
    }
```

- [ ] **Step 6: Eseguire tutta la suite**

```bash
mvn -q test
```

Attesa: PASS. In particolare i test di `adapter/in/web` devono restare verdi
senza modifiche: è la prova che l'ereditarietà ha fatto il suo lavoro.

- [ ] **Step 7: Commit**

```bash
git add src/main/java/com/fantaagent src/test/java/com/fantaagent
git commit -m "Tipizza i rifiuti d'acquisto senza toccare i controller HTML

L'API ha bisogno di un type stabile per ogni rifiuto, ma distinguere i
motivi per stringa e' fragile. PurchaseRejectedException estende
IllegalArgumentException: i controller Thymeleaf la catturano come prima
e nessuno dei loro test cambia."
```

---

### Task 7: L'acquisto diventa idempotente

**Files:**
- Modify: `src/main/java/com/fantaagent/domain/auction/AuctionEvent.java`
- Modify: `src/main/java/com/fantaagent/adapter/out/file/event/EventDto.java`
- Modify: `src/main/java/com/fantaagent/application/service/AuctionService.java`
- Create: `src/main/java/com/fantaagent/adapter/in/api/PurchaseApi.java`
- Create: `src/main/java/com/fantaagent/adapter/in/api/dto/PurchaseDtos.java`
- Test: `src/test/java/com/fantaagent/application/service/IdempotentPurchaseTest.java`
- Test: `src/test/java/com/fantaagent/adapter/in/api/PurchaseApiTest.java`

**Interfaces:**
- Produces:
  - `AuctionEvent.PlayerPurchased(long seq, Instant at, String playerId, String participantId, int price, String requestId)` — `requestId` annullabile.
  - `AuctionService.recordPurchase(String playerId, String participantId, int price, String requestId)` → `long` (il seq scritto, o quello dell'acquisto già registrato con quella chiave).
  - `AuctionService.recordPurchase(String, String, int)` resta e delega con `requestId` nullo.

- [ ] **Step 1: Scrivere il test di dominio, che deve fallire**

`src/test/java/com/fantaagent/application/service/IdempotentPurchaseTest.java`:

```java
package com.fantaagent.application.service;

import com.fantaagent.application.port.out.AuctionEventStore;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class IdempotentPurchaseTest {

    private static final LeagueRules RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 2, Role.C, 1, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static final Player BASTONI = new Player("d1", "Bastoni", "Inter", Role.D, 20);

    private final AuctionEventStore store = new InMemoryEventStore();

    private AuctionService service() {
        PlayerCatalog catalog = new PlayerCatalog() {
            @Override
            public Optional<Player> byId(String id) {
                return "d1".equals(id) ? Optional.of(BASTONI) : Optional.empty();
            }

            @Override
            public List<Player> all() {
                return List.of(BASTONI);
            }
        };
        return new AuctionService(RULES,
                List.of(new Participant("anna", "Anna", 'A', true),
                        new Participant("bruno", "Bruno", 'B', false)),
                catalog, store);
    }

    @Test
    void laStessaChiaveNonScriveDueVolte() {
        AuctionService service = service();

        long first = service.recordPurchase("d1", "anna", 20, "req-1");
        long second = service.recordPurchase("d1", "anna", 20, "req-1");

        assertThat(second).isEqualTo(first);
        assertThat(store.load()).hasSize(1);
        assertThat(service.state().holdings()).hasSize(1);
    }

    @Test
    void chiaviDiverseScrivonoDueEventi() {
        AuctionService service = service();
        service.recordPurchase("d1", "anna", 20, "req-1");

        // Secondo acquisto dello STESSO giocatore: viene rifiutato dal dominio,
        // non silenziato dall'idempotenza. La chiave protegge dai doppi invii,
        // non dalle regole d'asta.
        assertThat(store.load()).hasSize(1);
    }

    @Test
    void senzaChiaveIlComportamentoRestaQuelloDiPrima() {
        AuctionService service = service();
        service.recordPurchase("d1", "anna", 20);

        assertThat(store.load()).hasSize(1);
    }
}
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

```bash
mvn -q test -Dtest=IdempotentPurchaseTest
```

Attesa: FAIL — `recordPurchase` non accetta quattro argomenti.

- [ ] **Step 3: Aggiungere il campo all'evento**

In `AuctionEvent.java`, sostituisci il record `PlayerPurchased`:

```java
    /**
     * @param requestId chiave di idempotenza della richiesta che lo ha prodotto.
     *                  Null nei registri scritti prima che l'idempotenza
     *                  esistesse, e per le scritture che non passano dall'API:
     *                  significa "nessuna richiesta da riconoscere", non errore.
     */
    record PlayerPurchased(long seq, Instant at, String playerId, String participantId,
                           int price, String requestId) implements AuctionEvent {

        public PlayerPurchased {
            if (price < 1) {
                throw new IllegalArgumentException("price must be at least 1");
            }
        }

        /** Forma senza chiave, per le scritture che non vengono da una richiesta HTTP. */
        public PlayerPurchased(long seq, Instant at, String playerId, String participantId,
                               int price) {
            this(seq, at, playerId, participantId, price, null);
        }
    }
```

Il costruttore compatto in più mantiene compilanti **tutti** i punti di chiamata
esistenti, test compresi. Nessun file di `adapter/in/web` va toccato.

- [ ] **Step 4: Serializzare la chiave**

In `EventDto.java`, aggiungi `String requestId` come ultimo componente del record
e aggiorna i due `switch`:

```java
public record EventDto(
        String type, long seq, Instant at, Role role, String playerId,
        String participantId, Integer price, Long targetSeq, String name,
        String requestId) {
```

In `from`, il ramo `PlayerPurchased`:

```java
            case AuctionEvent.PlayerPurchased e ->
                    new EventDto("PlayerPurchased", e.seq(), e.at(), null,
                            e.playerId(), e.participantId(), e.price(), null, null,
                            e.requestId());
```

Ogni altro ramo riceve un `null` finale in più. In `toDomain`:

```java
            case "PlayerPurchased" ->
                    new AuctionEvent.PlayerPurchased(seq, at, playerId, participantId,
                            price, requestId);
```

I registri esistenti non hanno il campo: Jackson lo lascia a `null`, che è
esattamente il significato voluto.

- [ ] **Step 5: Implementare l'idempotenza nel servizio**

In `AuctionService`, sostituisci `recordPurchase` con questa coppia:

```java
    public void recordPurchase(String playerId, String participantId, int price) {
        recordPurchase(playerId, participantId, price, null);
    }

    /**
     * @param requestId chiave di idempotenza, o null. Se una richiesta con la
     *                  stessa chiave e' gia' stata registrata, non viene scritto
     *                  nulla e si restituisce il seq di allora.
     * @return il seq dell'acquisto registrato
     */
    public long recordPurchase(String playerId, String participantId, int price,
                               String requestId) {
        // Il controllo della chiave precede ogni validazione: un secondo invio
        // della stessa richiesta deve riuscire come il primo, anche se nel
        // frattempo quel giocatore risulta venduto — venduto proprio da lei.
        if (requestId != null) {
            Optional<Long> already = seqOf(requestId);
            if (already.isPresent()) {
                return already.get();
            }
        }

        Player player = catalog.byId(playerId)
                .orElseThrow(() -> new IllegalArgumentException("giocatore sconosciuto: " + playerId));
        Participant buyer = participants().stream()
                .filter(p -> p.id().equals(participantId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "partecipante sconosciuto: " + participantId));
        if (price < 1) {
            throw new IllegalArgumentException("il prezzo deve essere almeno 1");
        }

        AuctionState current = state();
        if (current.soldPlayerIds().contains(playerId)) {
            throw new PurchaseRejectedException(PurchaseRejectedException.Reason.ALREADY_SOLD,
                    player.name() + " è già stato acquistato");
        }
        Squad squad = current.squadOf(buyer.id());
        if (price > squad.budgetRemaining()) {
            throw new PurchaseRejectedException(
                    PurchaseRejectedException.Reason.INSUFFICIENT_BUDGET,
                    buyer.name() + " ha solo " + squad.budgetRemaining()
                    + " crediti di budget residuo");
        }
        if (!squad.hasRoom(player.role())) {
            throw new PurchaseRejectedException(
                    PurchaseRejectedException.Reason.ROLE_SLOTS_EXHAUSTED,
                    buyer.name() + " ha già coperto tutti gli slot " + player.role());
        }

        AuctionEvent written = scope.get().store().appendWithNextSeq(
                seq -> new AuctionEvent.PlayerPurchased(seq, Instant.now(), playerId,
                        buyer.id(), price, requestId));
        markChangedInThisSession();
        return written.seq();
    }

    /** Il seq dell'acquisto scritto per quella chiave, se c'e' gia' stato. */
    private Optional<Long> seqOf(String requestId) {
        return scope.get().store().load().stream()
                .filter(AuctionEvent.PlayerPurchased.class::isInstance)
                .map(AuctionEvent.PlayerPurchased.class::cast)
                .filter(p -> requestId.equals(p.requestId()))
                .map(AuctionEvent.PlayerPurchased::seq)
                .findFirst();
    }
```

- [ ] **Step 6: Eseguire i test di dominio**

```bash
mvn -q test -Dtest=IdempotentPurchaseTest
```

Attesa: PASS.

- [ ] **Step 7: Scrivere il test dell'endpoint, che deve fallire**

`src/test/java/com/fantaagent/adapter/in/api/PurchaseApiTest.java`:

```java
package com.fantaagent.adapter.in.api;

import com.fantaagent.application.service.AuctionService;
import com.fantaagent.application.service.PurchaseRejectedException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
class PurchaseApiTest {

    private static final String URL = "/api/leagues/default/auctions/a1/purchases";

    private static final String BODY = """
            {"requestId":"req-1","playerId":"d1","participantId":"anna","price":47}
            """;

    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private AuctionService auction;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    void aggiudicaEPortaIlSeqScritto() throws Exception {
        when(auction.recordPurchase("d1", "anna", 47, "req-1")).thenReturn(7L);

        mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.seq").value(7))
                .andExpect(jsonPath("$.playerId").value("d1"))
                .andExpect(jsonPath("$.price").value(47));

        verify(auction).recordPurchase("d1", "anna", 47, "req-1");
    }

    @Test
    void ilGiocatoreGiaVendutoDaUn409Tipizzato() throws Exception {
        when(auction.recordPurchase("d1", "anna", 47, "req-1"))
                .thenThrow(new PurchaseRejectedException(
                        PurchaseRejectedException.Reason.ALREADY_SOLD,
                        "Bastoni è già stato acquistato"));

        mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.type")
                        .value("https://fantaagent.local/problems/player-already-sold"))
                .andExpect(jsonPath("$.detail").value("Bastoni è già stato acquistato"));
    }

    @Test
    void ilBudgetInsufficienteDaUn422Tipizzato() throws Exception {
        when(auction.recordPurchase("d1", "anna", 47, "req-1"))
                .thenThrow(new PurchaseRejectedException(
                        PurchaseRejectedException.Reason.INSUFFICIENT_BUDGET,
                        "Anna ha solo 12 crediti di budget residuo"));

        mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.type")
                        .value("https://fantaagent.local/problems/insufficient-budget"));
    }

    @Test
    void laChiaveDiIdempotenzaEObbligatoria() throws Exception {
        mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"playerId":"d1","participantId":"anna","price":47}
                                """))
                .andExpect(status().isBadRequest());
    }
}
```

- [ ] **Step 8: Eseguire e verificare il fallimento**

```bash
mvn -q test -Dtest=PurchaseApiTest
```

Attesa: FAIL — 404, l'endpoint non esiste.

- [ ] **Step 9: Scrivere DTO e controller**

`src/main/java/com/fantaagent/adapter/in/api/dto/PurchaseDtos.java`:

```java
package com.fantaagent.adapter.in.api.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public final class PurchaseDtos {

    private PurchaseDtos() {
    }

    /**
     * @param requestId chiave generata dal client, obbligatoria. Senza rete di
     *                  mezzo un acquisto non poteva partire due volte; con la
     *                  rete, una risposta persa e un secondo clic scrivono due
     *                  eventi che il registro append-only non puo' cancellare —
     *                  puo' solo compensarli dopo, a danno fatto.
     */
    public record PurchaseRequest(@NotBlank String requestId, @NotBlank String playerId,
                                  @NotBlank String participantId, @Min(1) int price) {
    }

    public record PurchaseResponse(long seq, String playerId, String participantId, int price) {
    }
}
```

`src/main/java/com/fantaagent/adapter/in/api/PurchaseApi.java`:

```java
package com.fantaagent.adapter.in.api;

import com.fantaagent.adapter.in.api.dto.PurchaseDtos;
import com.fantaagent.application.service.AuctionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/leagues/{leagueId}/auctions/{auctionId}")
public class PurchaseApi {

    private final LeagueGuard leagues;
    private final AuctionService auction;

    public PurchaseApi(LeagueGuard leagues, AuctionService auction) {
        this.leagues = leagues;
        this.auction = auction;
    }

    @PostMapping("/purchases")
    @ResponseStatus(HttpStatus.CREATED)
    public PurchaseDtos.PurchaseResponse buy(@PathVariable String leagueId,
                                             @Valid @RequestBody PurchaseDtos.PurchaseRequest body) {
        leagues.check(leagueId);
        long seq = auction.recordPurchase(body.playerId(), body.participantId(),
                body.price(), body.requestId());
        return new PurchaseDtos.PurchaseResponse(seq, body.playerId(),
                body.participantId(), body.price());
    }
}
```

- [ ] **Step 10: Eseguire tutta la suite**

```bash
mvn -q test
```

Attesa: PASS. Se qualche test di `adapter/out/file` fallisce sulla forma
serializzata, è perché asserisce sul JSON esatto dell'evento: aggiorna
l'atteso aggiungendo `"requestId":null` — è l'unico punto in cui il formato
cambia visibilmente.

- [ ] **Step 11: Commit**

```bash
git add src/main src/test
git commit -m "Rende l'acquisto idempotente, con la chiave nel registro

La chiave vive nell'evento perche' deve sopravvivere al riavvio come tutto
il resto dello stato. PlayerPurchased guadagna un requestId annullabile: i
registri esistenti lo leggono come null, e un costruttore compatto tiene
compilanti tutti i punti di chiamata gia' presenti.

Il controllo della chiave precede le validazioni: un secondo invio della
stessa richiesta deve riuscire come il primo, anche se nel frattempo quel
giocatore risulta venduto — venduto proprio da lei."
```

---

### Task 8: Annullamento e cambio di fase

**Files:**
- Modify: `src/main/java/com/fantaagent/adapter/in/api/PurchaseApi.java`
- Test: `src/test/java/com/fantaagent/adapter/in/api/PhaseAndVoidApiTest.java`

**Interfaces:**
- Consumes: `AuctionService.revokePurchase(long)`, `.undoLast()`,
  `.selectPhase(Role)`, `.advancePhase()`.
- Produces: `POST /purchases/{seq}/void` → 204; `POST /purchases/void-last` → 204
  o 409 se non c'era nulla da annullare; `POST /phase` con corpo
  `{"role":"C"}` → 204.

- [ ] **Step 1: Scrivere il test, che deve fallire**

`src/test/java/com/fantaagent/adapter/in/api/PhaseAndVoidApiTest.java`:

```java
package com.fantaagent.adapter.in.api;

import com.fantaagent.application.service.AuctionService;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
class PhaseAndVoidApiTest {

    private static final String BASE = "/api/leagues/default/auctions/a1";

    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private AuctionService auction;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    void annullaUnAcquistoPreciso() throws Exception {
        mvc.perform(post(BASE + "/purchases/7/void"))
                .andExpect(status().isNoContent());

        verify(auction).revokePurchase(7L);
    }

    @Test
    void annullaLUltimo() throws Exception {
        when(auction.undoLast()).thenReturn(true);

        mvc.perform(post(BASE + "/purchases/void-last"))
                .andExpect(status().isNoContent());
    }

    @Test
    void nienteDaAnnullareDaUn409Tipizzato() throws Exception {
        when(auction.undoLast()).thenReturn(false);

        mvc.perform(post(BASE + "/purchases/void-last"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type")
                        .value("https://fantaagent.local/problems/nothing-to-undo"));
    }

    @Test
    void cambiaFase() throws Exception {
        when(auction.selectPhase(Role.C)).thenReturn(true);

        mvc.perform(post(BASE + "/phase").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"C\"}"))
                .andExpect(status().isNoContent());

        verify(auction).selectPhase(Role.C);
    }
}
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

```bash
mvn -q test -Dtest=PhaseAndVoidApiTest
```

Attesa: FAIL — 404 su tutte e quattro.

- [ ] **Step 3: Aggiungere l'eccezione per "niente da annullare"**

`src/main/java/com/fantaagent/adapter/in/api/NothingToUndoException.java`:

```java
package com.fantaagent.adapter.in.api;

public class NothingToUndoException extends RuntimeException {

    public NothingToUndoException() {
        super("Non c'è nessun acquisto da annullare.");
    }
}
```

In `ApiExceptionHandler`:

```java
    @ExceptionHandler(NothingToUndoException.class)
    ProblemDetail nothingToUndo(NothingToUndoException e) {
        return problem(HttpStatus.CONFLICT, "nothing-to-undo", e.getMessage());
    }
```

- [ ] **Step 4: Aggiungere gli endpoint**

In `PurchaseApi`, dopo `buy`:

```java
    @PostMapping("/purchases/{seq}/void")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void voidPurchase(@PathVariable String leagueId, @PathVariable long seq) {
        leagues.check(leagueId);
        auction.revokePurchase(seq);
    }

    @PostMapping("/purchases/void-last")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void voidLast(@PathVariable String leagueId) {
        leagues.check(leagueId);
        if (!auction.undoLast()) {
            throw new NothingToUndoException();
        }
    }

    public record PhaseRequest(@NotNull Role role) {
    }

    @PostMapping("/phase")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void phase(@PathVariable String leagueId, @Valid @RequestBody PhaseRequest body) {
        leagues.check(leagueId);
        // Il valore di ritorno "era gia' quella fase" non e' un errore: la
        // richiesta esprime uno stato voluto, e quello stato e' gia' vero.
        auction.selectPhase(body.role());
    }
```

Aggiungi gli import: `com.fantaagent.domain.player.Role`,
`jakarta.validation.constraints.NotNull`.

- [ ] **Step 5: Eseguire i test**

```bash
mvn -q test -Dtest=PhaseAndVoidApiTest && mvn -q test
```

Attesa: PASS in entrambi i casi.

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/fantaagent/adapter/in/api src/test/java/com/fantaagent/adapter/in/api
git commit -m "Aggiunge annullamento e cambio di fase all'API

Cambiare fase quando ci si e' gia' non e' un errore: la richiesta esprime
uno stato voluto, e quello stato e' gia' vero."
```

---

### Task 9: Il tabellone, e la garanzia che non porti tetti

**Il task più importante della tappa.** Oggi la pagina proiettata non può
mostrare il max bid perché `PublicBidder` non ha il campo. Un'API JSON lo
esporrebbe a chiunque apra la scheda di rete del browser, anche senza che
l'interfaccia lo disegni.

**Files:**
- Create: `src/main/java/com/fantaagent/adapter/in/api/board/BoardApi.java`
- Create: `src/main/java/com/fantaagent/adapter/in/api/board/BoardDtos.java`
- Modify: `src/test/java/com/fantaagent/architecture/ArchitectureTest.java`
- Test: `src/test/java/com/fantaagent/adapter/in/api/board/BoardApiTest.java`

**Interfaces:**
- Produces: `GET /board` → `BoardDtos.BoardResponse`, i cui record **non hanno**
  campi di valutazione. Il package `adapter.in.api.board` non può raggiungere il
  package `domain.strategy`.

- [ ] **Step 1: Scrivere la regola ArchUnit, che deve fallire**

In `ArchitectureTest.java`, aggiungi:

```java
    /**
     * La pagina proiettata sullo schermo condiviso non deve poter mostrare il
     * prezzo consigliato. Non basta che l'interfaccia non lo disegni: basta che
     * l'endpoint lo restituisca, e chiunque apra la scheda di rete del browser —
     * o punti un telefono sulla stessa URL — lo legge.
     *
     * <p>Con Thymeleaf la garanzia era che PublicBidder non avesse il campo. Qui
     * e' che il package del tabellone non possa nemmeno nominare i tipi da cui un
     * prezzo consigliato proviene. Chi fa fallire questo test sta per proiettare
     * i propri tetti sullo schermo che guardano tutti gli avversari.
     */
    @Test
    void boardApiCannotReachValuation() {
        noClasses().that().resideInAPackage("com.fantaagent.adapter.in.api.board..")
                .should().dependOnClassesThat().resideInAnyPackage(
                        "com.fantaagent.domain.strategy..")
                .because("il tabellone e' proiettato: non puo' contenere valutazioni")
                .allowEmptyShould(true)
                .check(classes);
    }
```

- [ ] **Step 2: Scrivere il test di serializzazione, che deve fallire**

`src/test/java/com/fantaagent/adapter/in/api/board/BoardApiTest.java`:

```java
package com.fantaagent.adapter.in.api.board;

import com.fantaagent.application.service.AuctionService;
import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.auction.Holding;
import com.fantaagent.domain.auction.Squad;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
class BoardApiTest {

    private static final LeagueRules RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 2, Role.C, 1, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static final Holding BASTONI = new Holding(1, "d1", Role.D, "anna", 47);

    private static final AuctionState STATE = new AuctionState(RULES, Role.D, "anna",
            Map.of("anna", new Squad("anna", List.of(BASTONI), RULES),
                   "bruno", new Squad("bruno", List.of(), RULES)),
            List.of(BASTONI));

    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private AuctionService auction;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
        when(auction.state()).thenReturn(STATE);
        when(auction.auctionId()).thenReturn("a1");
        when(auction.participants()).thenReturn(List.of(
                new Participant("anna", "Anna", 'A', true),
                new Participant("bruno", "Bruno", 'B', false)));
        when(auction.playerName(BASTONI)).thenReturn("Bastoni");
    }

    @Test
    void portaLeRoseConIPrezziPagati() throws Exception {
        mvc.perform(get("/api/leagues/default/auctions/a1/board"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.columns[0].participantName").value("Anna"))
                .andExpect(jsonPath("$.columns[0].byRole.D[0].playerName").value("Bastoni"))
                .andExpect(jsonPath("$.columns[0].byRole.D[0].price").value(47));
    }

    /**
     * Il vincolo strutturale, verificato sul corpo vero e non sul tipo Java: se
     * un giorno qualcuno aggiungesse un campo di valutazione a un DTO del
     * tabellone, questo test lo vedrebbe uscire dal filo.
     */
    @Test
    void nonContieneNessunaParolaDelVocabolarioDelleValutazioni() throws Exception {
        MvcResult result = mvc.perform(get("/api/leagues/default/auctions/a1/board"))
                .andExpect(status().isOk())
                .andReturn();

        String json = result.getResponse().getContentAsString(StandardCharsets.UTF_8);

        assertThat(json).doesNotContain("maxBid");
        assertThat(json).doesNotContain("expectedPrice");
        assertThat(json).doesNotContain("margin");
        assertThat(json).doesNotContain("hardCap");
        assertThat(json).doesNotContain("walkAway");
        assertThat(json).doesNotContain("confidence");
        assertThat(json).doesNotContain("drivers");
        assertThat(json).doesNotContain("worthPursuing");
    }
}
```

- [ ] **Step 3: Eseguire e verificare il fallimento**

```bash
mvn -q test -Dtest=BoardApiTest
```

Attesa: FAIL — 404, l'endpoint non esiste.

- [ ] **Step 4: Scrivere i DTO del tabellone**

`src/main/java/com/fantaagent/adapter/in/api/board/BoardDtos.java`:

```java
package com.fantaagent.adapter.in.api.board;

import com.fantaagent.domain.player.Role;

import java.util.List;
import java.util.Map;

/**
 * I record del tabellone proiettato.
 *
 * <p>Vivono in un package proprio, e non insieme agli altri DTO dell'API, per un
 * motivo solo: cosi' una regola ArchUnit puo' dire "questo package non puo'
 * raggiungere le valutazioni" e la build fallisce se qualcuno ci prova. Un flag
 * "nascondi il prezzo" si dimentica; un package che non compila, no.
 *
 * <p>Chi aggiunge qui un campo che viene da una valutazione lo sta proiettando su
 * uno schermo che guardano tutti gli avversari.
 */
public final class BoardDtos {

    private BoardDtos() {
    }

    /** Una casella della rosa: il giocatore e quanto e' stato PAGATO. */
    public record BoardSlot(long seq, String playerName, int price) {
    }

    public record BoardColumn(String participantId, String participantName, boolean me,
                              int budgetRemaining, int slotsRemaining,
                              Map<Role, List<BoardSlot>> byRole) {
    }

    public record BoardResponse(String auctionId, Role currentPhase, List<BoardColumn> columns) {
    }
}
```

- [ ] **Step 5: Scrivere il controller**

`src/main/java/com/fantaagent/adapter/in/api/board/BoardApi.java`:

```java
package com.fantaagent.adapter.in.api.board;

import com.fantaagent.adapter.in.api.LeagueGuard;
import com.fantaagent.application.service.AuctionService;
import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.auction.Holding;
import com.fantaagent.domain.auction.Squad;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Role;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/leagues/{leagueId}/auctions/{auctionId}")
public class BoardApi {

    private final LeagueGuard leagues;
    private final AuctionService auction;

    public BoardApi(LeagueGuard leagues, AuctionService auction) {
        this.leagues = leagues;
        this.auction = auction;
    }

    @GetMapping("/board")
    public BoardDtos.BoardResponse board(@PathVariable String leagueId) {
        leagues.check(leagueId);
        AuctionState state = auction.state();
        List<BoardDtos.BoardColumn> columns = auction.participants().stream()
                .map(p -> column(p, state.squadOf(p.id())))
                .toList();
        return new BoardDtos.BoardResponse(auction.auctionId(), state.currentPhase(), columns);
    }

    private BoardDtos.BoardColumn column(Participant p, Squad squad) {
        Map<Role, List<BoardDtos.BoardSlot>> byRole = new LinkedHashMap<>();
        for (Role role : Role.values()) {
            byRole.put(role, squad.holdings().stream()
                    .filter(h -> h.role() == role)
                    .map(this::slot)
                    .toList());
        }
        return new BoardDtos.BoardColumn(p.id(), p.name(), p.me(),
                squad.budgetRemaining(), squad.slotsRemaining(), byRole);
    }

    private BoardDtos.BoardSlot slot(Holding h) {
        return new BoardDtos.BoardSlot(h.seq(), auction.playerName(h), h.price());
    }
}
```

- [ ] **Step 6: Eseguire i test**

```bash
mvn -q test -Dtest=BoardApiTest && mvn -q test -Dtest=ArchitectureTest
```

Attesa: PASS in entrambi i casi.

- [ ] **Step 7: Verificare che la regola ArchUnit morda davvero**

Prova deliberata: aggiungi temporaneamente in `BoardDtos.java` un campo
`int maxBid` a `BoardSlot`, e importa `PriceRecommendation`.

```bash
mvn -q test -Dtest=ArchitectureTest
```

Attesa: **FAIL** su `boardApiCannotReachValuation`. Se passa, la regola non sta
guardando il package giusto e va corretta prima di proseguire. Poi rimuovi la
modifica.

Questo passo non è cerimoniale: una regola ArchUnit che non fallisce mai è una
regola che non protegge niente, ed è già successo in questo progetto — vedi il
commento su `allowEmptyShould(true)` in `ArchitectureTest`.

- [ ] **Step 8: Eseguire tutta la suite e committare**

```bash
mvn -q test
git add src/main/java/com/fantaagent/adapter/in/api/board src/test/java/com/fantaagent
git commit -m "Espone il tabellone, e impedisce che porti valutazioni

Con Thymeleaf la garanzia era che PublicBidder non avesse il campo. Con
un'API non basta che l'interfaccia non disegni il tetto: basta che
l'endpoint lo restituisca, e chiunque apra la scheda di rete lo legge.

Tre difese: DTO in un package proprio, una regola ArchUnit che vieta a
quel package di raggiungere domain.strategy, e un test che cerca il
vocabolario delle valutazioni dentro il corpo JSON vero."
```

---

## Tappa 3 — La schermata d'asta

### Task 10: Il client, e la traduzione degli errori

**Files:**
- Create: `frontend/src/api/types.ts`
- Create: `frontend/src/api/client.ts`
- Test: `frontend/src/api/client.test.ts`

**Interfaces:**
- Produces:
  - `ProblemError` con `.slug`, `.detail`, `.status`.
  - `apiGet<T>(path: string): Promise<T>` e
    `apiPost<T>(path: string, body?: unknown): Promise<T | null>`, dove `path` è
    relativo all'asta (`/state`, `/players?q=…`).
  - `setAuctionContext({ leagueId, auctionId })`.
  - I tipi `AuctionStateResponse`, `ValuationResponse`, `PhasePageResponse`,
    `PlayerSummary`, `BoardResponse` — specchio esatto dei DTO Java.

- [ ] **Step 1: Scrivere i tipi**

`frontend/src/api/types.ts`:

```ts
export type Role = 'P' | 'D' | 'C' | 'A';

export interface ParticipantView {
  id: string;
  name: string;
  initial: string;
  me: boolean;
  budgetRemaining: number;
  slotsRemaining: number;
  filledByRole: Record<Role, number>;
  slotsByRole: Record<Role, number>;
}

export interface AuctionStateResponse {
  auctionId: string;
  auctionName: string;
  currentPhase: Role;
  phases: Role[];
  soldInPhase: number;
  myParticipantId: string;
  canUndo: boolean;
  participants: ParticipantView[];
}

export interface PlayerSummary {
  id: string;
  name: string;
  team: string;
  role: Role;
  listPrice: number;
}

export interface DriverView {
  label: string;
  contribution: number;
  explanation: string;
}

/**
 * Non estende PlayerSummary: il DTO Java identifica il giocatore con
 * `playerId`, non con `id`, e ereditare porterebbe in TypeScript un campo che
 * dal filo non arriva mai.
 */
export interface ValuationResponse {
  playerId: string;
  name: string;
  team: string;
  role: Role;
  listPrice: number;
  expectedPrice: number;
  maxBid: number;
  hardCap: number;
  margin: number;
  walkAwayReason: string;
  worthPursuing: boolean;
  confidenceStars: number;
  drivers: DriverView[];
}

export interface PhaseRowView extends PlayerSummary {
  maxBid: number;
  expectedPrice: number;
  margin: number;
  fantamediaAttesa: number;
  titolaritaPercent: number;
}

export interface PhasePageResponse {
  rows: PhaseRowView[];
  offset: number;
  pageSize: number;
  total: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface PurchaseResponse {
  seq: number;
  playerId: string;
  participantId: string;
  price: number;
}
```

- [ ] **Step 2: Scrivere il test, che deve fallire**

`frontend/src/api/client.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProblemError, apiGet, apiPost, setAuctionContext } from './client';

describe('client API', () => {
  beforeEach(() => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('costruisce la URL nella forma multi-lega', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await apiGet('/state');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/leagues/default/auctions/a1/state',
      expect.anything(),
    );
  });

  it("traduce problem+json in un errore con lo slug del tipo", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: 'https://fantaagent.local/problems/insufficient-budget',
            detail: 'Anna ha solo 12 crediti di budget residuo',
            status: 422,
          }),
          { status: 422, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );

    await expect(apiPost('/purchases', {})).rejects.toMatchObject({
      slug: 'insufficient-budget',
      detail: 'Anna ha solo 12 crediti di budget residuo',
      status: 422,
    });
  });

  it('un errore senza corpo problem resta comunque un ProblemError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 500 })),
    );

    await expect(apiGet('/state')).rejects.toBeInstanceOf(ProblemError);
  });

  it('una risposta 204 non prova a leggere JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(apiPost('/phase', { role: 'C' })).resolves.toBeNull();
  });
});
```

- [ ] **Step 3: Eseguire e verificare il fallimento**

```bash
cd frontend && npx vitest run src/api/client.test.ts
```

Attesa: FAIL — `Failed to resolve import "./client"`.

- [ ] **Step 4: Scrivere il client**

`frontend/src/api/client.ts`:

```ts
const PROBLEM_PREFIX = 'https://fantaagent.local/problems/';

export class ProblemError extends Error {
  constructor(
    readonly type: string,
    readonly detail: string,
    readonly status: number,
  ) {
    super(detail);
    this.name = 'ProblemError';
  }

  /** L'ultimo segmento del type: e' su questo che l'interfaccia decide. */
  get slug(): string {
    return this.type.startsWith(PROBLEM_PREFIX)
      ? this.type.slice(PROBLEM_PREFIX.length)
      : 'unknown';
  }
}

let context = { leagueId: 'default', auctionId: '' };

export function setAuctionContext(next: { leagueId: string; auctionId: string }) {
  context = next;
}

function url(path: string): string {
  return `/api/leagues/${context.leagueId}/auctions/${context.auctionId}${path}`;
}

async function toProblem(response: Response): Promise<ProblemError> {
  try {
    const body = await response.json();
    return new ProblemError(
      body.type ?? 'unknown',
      body.detail ?? response.statusText,
      response.status,
    );
  } catch {
    // Un 502 da un proxy, o la connessione caduta a meta' risposta: non c'e'
    // un corpo problem da leggere, ma chi chiama deve gestire un errore solo.
    return new ProblemError('unknown', `Errore di rete (${response.status})`, response.status);
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T | null> {
  const response = await fetch(url(path), init);
  if (!response.ok) {
    throw await toProblem(response);
  }
  if (response.status === 204) {
    return null;
  }
  return (await response.json()) as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  return (await request<T>(path, { headers: { accept: 'application/json' } })) as T;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T | null> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
```

- [ ] **Step 5: Eseguire il test e committare**

```bash
cd frontend && npx vitest run src/api/client.test.ts
cd /Users/luigidinuzzo/Progetti/FantaAgent
git add frontend/src/api
git commit -m "Aggiunge il client API con la traduzione di problem+json

Un solo posto traduce gli errori del server: lo slug del type e' cio' su
cui l'interfaccia decide, mai il testo del messaggio."
```

---

### Task 11: Gli hook, e la cache che non diventa una seconda verità

**Files:**
- Create: `frontend/src/api/hooks.ts`
- Create: `frontend/src/api/QueryProvider.tsx`
- Test: `frontend/src/api/hooks.test.tsx`

**Interfaces:**
- Produces:
  - `useAuctionState()` → `UseQueryResult<AuctionStateResponse>`
  - `useValuation(playerId: string | null)` → `UseQueryResult<ValuationResponse>`
  - `usePhasePlayers(offset: number)` → `UseQueryResult<PhasePageResponse>`
  - `useSearch(query: string)` → `UseQueryResult<PlayerSummary[]>`
  - `useAssign()` → mutazione; `mutate({playerId, participantId, price})`, genera
    la chiave di idempotenza da sé.
  - `<QueryProvider>` con `staleTime` e `refetchInterval` configurati.

- [ ] **Step 1: Scrivere il test, che deve fallire**

`frontend/src/api/hooks.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setAuctionContext } from './client';
import { useAssign, useAuctionState } from './hooks';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const STATE = {
  auctionId: 'a1',
  auctionName: 'Prova',
  currentPhase: 'D',
  phases: ['P', 'D', 'C', 'A'],
  soldInPhase: 1,
  myParticipantId: 'anna',
  canUndo: true,
  participants: [],
};

describe('hook', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('useAuctionState legge lo stato', async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(STATE), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    const { result } = renderHook(() => useAuctionState(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.currentPhase).toBe('D');
  });

  it('useAssign genera una chiave di idempotenza diversa per ogni invio', async () => {
    setAuctionContext({ leagueId: 'default', auctionId: 'a1' });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ seq: 1, playerId: 'd1', participantId: 'anna', price: 47 }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAssign(), { wrapper });

    result.current.mutate({ playerId: 'd1', participantId: 'anna', price: 47 });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const first = JSON.parse(fetchMock.mock.calls[0][1].body).requestId;

    result.current.mutate({ playerId: 'd2', participantId: 'anna', price: 12 });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const second = JSON.parse(fetchMock.mock.calls[1][1].body).requestId;

    expect(first).toBeTruthy();
    expect(second).not.toBe(first);
  });
});
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

```bash
cd frontend && npx vitest run src/api/hooks.test.tsx
```

Attesa: FAIL — `./hooks` non esiste.

- [ ] **Step 3: Scrivere il provider**

`frontend/src/api/QueryProvider.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useState } from 'react';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Cinque secondi: l'asta cambia quando qualcuno aggiudica, non di
            // continuo, e un intervallo piu' fitto interrogherebbe il server
            // senza che nulla sia successo.
            staleTime: 5_000,
            refetchInterval: 5_000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
          // Nessun tentativo automatico sulle scritture: un acquisto ripetuto
          // dalla libreria e' un acquisto che l'utente non ha chiesto. La chiave
          // di idempotenza protegge dai doppi invii voluti, non e' un permesso
          // di inviare due volte.
          mutations: { retry: 0 },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 4: Scrivere gli hook**

`frontend/src/api/hooks.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from './client';
import type {
  AuctionStateResponse,
  PhasePageResponse,
  PlayerSummary,
  PurchaseResponse,
  Role,
  ValuationResponse,
} from './types';

const KEYS = {
  state: ['state'] as const,
  phase: (offset: number) => ['phase', offset] as const,
  valuation: (playerId: string) => ['valuation', playerId] as const,
  search: (q: string) => ['search', q] as const,
};

export function useAuctionState() {
  return useQuery({
    queryKey: KEYS.state,
    queryFn: () => apiGet<AuctionStateResponse>('/state'),
  });
}

export function usePhasePlayers(offset: number) {
  return useQuery({
    queryKey: KEYS.phase(offset),
    queryFn: () => apiGet<PhasePageResponse>(`/players/phase?offset=${offset}&limit=25`),
  });
}

export function useValuation(playerId: string | null) {
  return useQuery({
    queryKey: KEYS.valuation(playerId ?? ''),
    queryFn: () => apiGet<ValuationResponse>(`/players/${playerId}/valuation`),
    enabled: playerId !== null,
  });
}

export function useSearch(query: string) {
  return useQuery({
    queryKey: KEYS.search(query),
    queryFn: () => apiGet<PlayerSummary[]>(`/players?q=${encodeURIComponent(query)}`),
    enabled: query.trim().length > 0,
  });
}

export interface AssignInput {
  playerId: string;
  participantId: string;
  price: number;
}

export function useAssign() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: AssignInput) =>
      apiPost<PurchaseResponse>('/purchases', {
        // Generata qui, una per invio: se la risposta si perde e l'utente
        // ripreme, quella e' una richiesta NUOVA con una chiave nuova. La chiave
        // protegge dal doppio invio della STESSA richiesta — un tentativo del
        // browser, non un secondo clic deliberato.
        requestId: crypto.randomUUID(),
        ...input,
      }),
    // Nessun aggiornamento ottimistico: mostrare l'acquisto come riuscito prima
    // che il registro abbia fatto fsync significa mentire nel momento in cui
    // conta di piu'. Si aspetta la conferma, che costa decine di millisecondi.
    onSuccess: () => {
      client.invalidateQueries();
    },
  });
}

export function useChangePhase() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (role: Role) => apiPost('/phase', { role }),
    onSuccess: () => client.invalidateQueries(),
  });
}

export function useUndoLast() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost('/purchases/void-last'),
    onSuccess: () => client.invalidateQueries(),
  });
}
```

- [ ] **Step 5: Eseguire il test e committare**

```bash
cd frontend && npx vitest run
cd /Users/luigidinuzzo/Progetti/FantaAgent
git add frontend/src/api
git commit -m "Aggiunge gli hook: la cache e' del server, non una seconda verita'

Nessun aggiornamento ottimistico sull'aggiudicazione e nessun tentativo
automatico sulle scritture. La chiave di idempotenza protegge dal doppio
invio della stessa richiesta, non e' un permesso di inviare due volte."
```

---

### Task 12: `PlayerDecisionCard` — l'unico elemento elevato

**Files:**
- Create: `frontend/src/domain/PlayerDecisionCard.tsx`
- Test: `frontend/src/domain/PlayerDecisionCard.test.tsx`

**Interfaces:**
- Consumes: `ValuationResponse` da `api/types`.
- Produces: `<PlayerDecisionCard valuation={…} stale={boolean} bidState={…} children={…} />`
  dove `bidState?: { currentBid: number }` e `children` ospita il `BidPanel` del
  Task 15.

- [ ] **Step 1: Scrivere il test, che deve fallire**

`frontend/src/domain/PlayerDecisionCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ValuationResponse } from '../api/types';
import { PlayerDecisionCard } from './PlayerDecisionCard';

const VALUATION: ValuationResponse = {
  playerId: 'd1',
  name: 'Bastoni',
  team: 'Inter',
  role: 'D',
  listPrice: 20,
  expectedPrice: 38,
  maxBid: 47,
  hardCap: 90,
  margin: 9,
  walkAwayReason: 'oltre 47 il completamento perde più di quanto guadagni',
  worthPursuing: true,
  confidenceStars: 4,
  drivers: [
    { label: 'budget', contribution: 3, explanation: 'budget capiente' },
    { label: 'alternative', contribution: -1, explanation: 'tre alternative sopra soglia' },
  ],
};

describe('PlayerDecisionCard', () => {
  it('mostra il tetto come numero dominante', () => {
    render(<PlayerDecisionCard valuation={VALUATION} stale={false} />);
    const maxBid = screen.getByTestId('max-bid');
    expect(maxBid).toHaveTextContent('47');
  });

  it('mostra mercato, margine e il verdetto', () => {
    render(<PlayerDecisionCard valuation={VALUATION} stale={false} />);
    expect(screen.getByTestId('expected-price')).toHaveTextContent('38');
    expect(screen.getByTestId('margin')).toHaveTextContent('+9');
    expect(screen.getByText('Prendi')).toBeInTheDocument();
  });

  it('quando non conviene mostra Lascia e la ragione', () => {
    render(
      <PlayerDecisionCard
        valuation={{ ...VALUATION, worthPursuing: false, margin: -4, maxBid: 11 }}
        stale={false}
      />,
    );
    expect(screen.getByText('Lascia')).toBeInTheDocument();
    expect(screen.getByTestId('margin')).toHaveTextContent('−4');
  });

  it('elenca i driver in parole, non in sigle', () => {
    render(<PlayerDecisionCard valuation={VALUATION} stale={false} />);
    expect(screen.getByText(/budget capiente/)).toBeInTheDocument();
    expect(screen.getByText(/tre alternative sopra soglia/)).toBeInTheDocument();
  });

  it('quando il dato e stantio si segnala come tale', () => {
    render(<PlayerDecisionCard valuation={VALUATION} stale />);
    expect(screen.getByTestId('decision-card')).toHaveAttribute('data-stale', 'true');
    // Il tetto resta leggibile: serve ancora. Cio' che cade e' la pretesa
    // che sia aggiornato.
    expect(screen.getByTestId('max-bid')).toHaveTextContent('47');
  });

  it('mostra lo stato dell offerta quando c e', () => {
    render(
      <PlayerDecisionCard valuation={VALUATION} stale={false} bidState={{ currentBid: 41 }} />,
    );
    expect(screen.getByText(/offerta a 41/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

```bash
cd frontend && npx vitest run src/domain/PlayerDecisionCard.test.tsx
```

Attesa: FAIL — il modulo non esiste.

- [ ] **Step 3: Scrivere il componente**

`frontend/src/domain/PlayerDecisionCard.tsx`:

```tsx
import type { ReactNode } from 'react';
import type { ValuationResponse } from '../api/types';

const ROLE_LABEL: Record<string, string> = {
  P: 'portiere',
  D: 'difensore',
  C: 'centrocampista',
  A: 'attaccante',
};

/** Il segno meno tipografico, non il trattino: e' un numero, non una parola spezzata. */
function signed(n: number): string {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}

export function PlayerDecisionCard({
  valuation,
  stale,
  bidState,
  children,
}: {
  valuation: ValuationResponse;
  stale: boolean;
  bidState?: { currentBid: number };
  children?: ReactNode;
}) {
  return (
    <section
      data-testid="decision-card"
      data-stale={stale}
      aria-busy={stale}
      className={[
        'relative border p-5 transition-opacity duration-200',
        // Il gradiente e' l'unico effetto decorativo del progetto, e sta su un
        // solo elemento: quello che decide.
        'bg-[radial-gradient(120%_90%_at_30%_0%,var(--color-surface)_0%,var(--color-background)_70%)]',
        stale ? 'border-dashed border-line opacity-60' : 'border-line-strong',
      ].join(' ')}
    >
      {/* Arco d'angolo: una linea di campo, non un ornamento. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 h-8 w-8 rounded-br-full border-b border-r border-line-strong"
      />

      <header className="flex items-baseline gap-3 pl-7">
        <h2 className="w-exp text-xl font-extrabold">{valuation.name}</h2>
        <p className="text-sm text-muted-foreground">
          {ROLE_LABEL[valuation.role]}, {valuation.team}
        </p>
        {bidState ? (
          <p className="ml-auto text-sm text-accent">offerta a {bidState.currentBid}</p>
        ) : null}
      </header>

      <div className="mt-4 flex flex-wrap items-end gap-8">
        <p>
          <span
            data-testid="max-bid"
            className="tnum w-exp block text-[76px] font-extrabold leading-[0.86] tracking-tight text-accent"
          >
            {valuation.maxBid}
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">il tuo tetto</span>
        </p>

        <dl className="pb-3 text-sm text-muted-foreground">
          <div className="flex gap-2">
            <dt>mercato</dt>
            <dd data-testid="expected-price" className="tnum text-foreground">
              {valuation.expectedPrice}
            </dd>
          </div>
          <div className="mt-1 flex gap-2">
            <dt>margine</dt>
            <dd
              data-testid="margin"
              className={`tnum ${valuation.worthPursuing ? 'text-positive' : 'text-destructive'}`}
            >
              {signed(valuation.margin)}
            </dd>
          </div>
        </dl>

        <p
          className={`pb-3 text-sm font-bold ${
            valuation.worthPursuing ? 'text-positive' : 'text-destructive'
          }`}
        >
          {valuation.worthPursuing ? 'Prendi' : 'Lascia'}
        </p>
      </div>

      <p className="mt-3 max-w-[60ch] text-sm text-muted-foreground">
        {valuation.drivers.map((d) => d.explanation).join(', ')}.
      </p>

      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}
```

- [ ] **Step 4: Eseguire il test**

```bash
cd frontend && npx vitest run src/domain/PlayerDecisionCard.test.tsx
```

Attesa: PASS, sei test.

- [ ] **Step 5: Commit**

```bash
cd /Users/luigidinuzzo/Progetti/FantaAgent
git add frontend/src/domain
git commit -m "Aggiunge la scheda che decide, unico elemento elevato

Il tetto e' l'audacia dell'intera pagina: 76px, tutto il resto sta zitto.
I driver escono in italiano corrente invece che a sigle, e da stantia la
scheda si smorza ma il tetto resta leggibile — serve ancora."
```

---

### Task 13: `PlayerTable` — tabella semantica, densa, incolonnata

**Files:**
- Create: `frontend/src/domain/PlayerTable.tsx`
- Test: `frontend/src/domain/PlayerTable.test.tsx`

**Interfaces:**
- Consumes: `PhaseRowView[]` da `api/types`.
- Produces: `<PlayerTable rows={…} selectedId={string|null} onSelect={(id) => void} />`

- [ ] **Step 1: Scrivere il test, che deve fallire**

`frontend/src/domain/PlayerTable.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PhaseRowView } from '../api/types';
import { PlayerTable } from './PlayerTable';

const ROWS: PhaseRowView[] = [
  {
    id: 'd1', name: 'Dimarco', team: 'INT', role: 'D', listPrice: 21,
    maxBid: 29, expectedPrice: 22, margin: 7, fantamediaAttesa: 6.8, titolaritaPercent: 88,
  },
  {
    id: 'd2', name: 'Gatti', team: 'JUV', role: 'D', listPrice: 16,
    maxBid: 11, expectedPrice: 15, margin: -4, fantamediaAttesa: 6.1, titolaritaPercent: 74,
  },
];

describe('PlayerTable', () => {
  it('e una tabella vera, con intestazione', () => {
    render(<PlayerTable rows={ROWS} selectedId={null} onSelect={() => {}} />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').length).toBeGreaterThan(3);
    expect(within(table).getAllByRole('row')).toHaveLength(3); // intestazione + 2
  });

  it('incolonna i numeri con le cifre tabulari', () => {
    render(<PlayerTable rows={ROWS} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByTestId('maxbid-d1')).toHaveClass('tnum');
  });

  it('distingue le righe sopra soglia', () => {
    render(<PlayerTable rows={ROWS} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByTestId('row-d2')).toHaveAttribute('data-above-threshold', 'true');
    expect(screen.getByTestId('row-d1')).toHaveAttribute('data-above-threshold', 'false');
  });

  it('seleziona una riga col clic e con la tastiera', async () => {
    const onSelect = vi.fn();
    render(<PlayerTable rows={ROWS} selectedId={null} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: /Dimarco/ }));
    expect(onSelect).toHaveBeenCalledWith('d1');

    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('segnala la riga selezionata agli assistivi', () => {
    render(<PlayerTable rows={ROWS} selectedId="d1" onSelect={() => {}} />);
    expect(screen.getByTestId('row-d1')).toHaveAttribute('aria-selected', 'true');
  });

  it('con nessun giocatore invita ad agire invece di restare vuota', () => {
    render(<PlayerTable rows={[]} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText(/Nessun giocatore libero in questa fase/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

```bash
cd frontend && npx vitest run src/domain/PlayerTable.test.tsx
```

Attesa: FAIL — il modulo non esiste.

- [ ] **Step 3: Scrivere il componente**

`frontend/src/domain/PlayerTable.tsx`:

```tsx
import type { PhaseRowView } from '../api/types';

export function PlayerTable({
  rows,
  selectedId,
  onSelect,
}: {
  rows: PhaseRowView[];
  selectedId: string | null;
  onSelect: (playerId: string) => void;
}) {
  if (rows.length === 0) {
    // Uno schermo vuoto e' un invito ad agire, non un errore muto.
    return (
      <p className="border border-dashed border-line p-6 text-sm text-muted-foreground">
        Nessun giocatore libero in questa fase. Passa alla fase successiva.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-cond w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line-strong text-left text-muted-foreground">
            <th scope="col" className="py-2 font-normal">Giocatore</th>
            <th scope="col" className="py-2 font-normal">Sq</th>
            <th scope="col" className="py-2 text-right font-normal">Quot</th>
            <th scope="col" className="py-2 text-right font-normal">Tetto</th>
            <th scope="col" className="py-2 text-right font-normal">FM attesa</th>
            <th scope="col" className="py-2 text-right font-normal">Titolarità</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const above = row.margin < 0;
            return (
              <tr
                key={row.id}
                data-testid={`row-${row.id}`}
                data-above-threshold={above}
                aria-selected={row.id === selectedId}
                className={`border-b border-line ${
                  row.id === selectedId ? 'bg-surface' : ''
                }`}
              >
                <td className="py-0">
                  {/* Il bersaglio e' un bottone vero: raggiungibile da tastiera,
                      annunciato come azione, e alto abbastanza da essere colpito. */}
                  <button
                    type="button"
                    onClick={() => onSelect(row.id)}
                    className="flex min-h-11 w-full items-center text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {row.name}
                  </button>
                </td>
                <td className="py-2 text-muted-foreground">{row.team}</td>
                <td className="tnum py-2 text-right text-muted-foreground">{row.listPrice}</td>
                <td
                  data-testid={`maxbid-${row.id}`}
                  className={`tnum py-2 text-right ${above ? 'text-destructive' : 'text-accent'}`}
                >
                  {row.maxBid}
                </td>
                <td className="tnum py-2 text-right text-muted-foreground">
                  {row.fantamediaAttesa.toFixed(1)}
                </td>
                <td className="tnum py-2 text-right text-muted-foreground">
                  {Math.round(row.titolaritaPercent)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Eseguire il test e committare**

```bash
cd frontend && npx vitest run src/domain/PlayerTable.test.tsx
cd /Users/luigidinuzzo/Progetti/FantaAgent
git add frontend/src/domain
git commit -m "Aggiunge la tabella di fase, semantica e densa

Tabella vera con thead e tbody, non una griglia di div: e' cosi' che un
lettore di schermo puo' dire in che colonna si trova. Il bersaglio di
selezione e' un bottone alto 44px, raggiungibile da tastiera."
```

---

### Task 14: `LeagueBoard` — la composizione si guarda, non si legge

Il documento del 2 settembre segnalava il difetto: il pannello ripeteva stringhe
grezze come `1P 3D 0C 0A` dove serviva una rappresentazione visiva.

**Files:**
- Create: `frontend/src/domain/LeagueBoard.tsx`
- Test: `frontend/src/domain/LeagueBoard.test.tsx`

**Interfaces:**
- Consumes: `ParticipantView[]` da `api/types`.
- Produces: `<LeagueBoard participants={…} />`

- [ ] **Step 1: Scrivere il test, che deve fallire**

`frontend/src/domain/LeagueBoard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ParticipantView } from '../api/types';
import { LeagueBoard } from './LeagueBoard';

const PARTICIPANTS: ParticipantView[] = [
  {
    id: 'anna', name: 'Anna', initial: 'A', me: true,
    budgetRemaining: 312, slotsRemaining: 17,
    filledByRole: { P: 1, D: 3, C: 0, A: 0 },
    slotsByRole: { P: 3, D: 8, C: 8, A: 6 },
  },
  {
    id: 'bruno', name: 'Bruno', initial: 'B', me: false,
    budgetRemaining: 289, slotsRemaining: 19,
    filledByRole: { P: 1, D: 2, C: 0, A: 0 },
    slotsByRole: { P: 3, D: 8, C: 8, A: 6 },
  },
];

describe('LeagueBoard', () => {
  it('mostra nome e budget di ciascuno', () => {
    render(<LeagueBoard participants={PARTICIPANTS} />);
    expect(screen.getByText('Anna')).toBeInTheDocument();
    expect(screen.getByTestId('budget-anna')).toHaveTextContent('312');
  });

  it('distingue visivamente me dagli altri', () => {
    render(<LeagueBoard participants={PARTICIPANTS} />);
    expect(screen.getByTestId('manager-anna')).toHaveAttribute('data-me', 'true');
    expect(screen.getByTestId('manager-bruno')).toHaveAttribute('data-me', 'false');
  });

  it('rende la composizione come barra segmentata, non come stringa', () => {
    render(<LeagueBoard participants={PARTICIPANTS} />);
    const bar = screen.getByTestId('composition-anna');
    expect(bar.querySelectorAll('[data-role]')).toHaveLength(4);
    expect(screen.queryByText('1P 3D 0C 0A')).not.toBeInTheDocument();
  });

  it('la barra resta comprensibile senza vederla', () => {
    render(<LeagueBoard participants={PARTICIPANTS} />);
    expect(screen.getByTestId('composition-anna')).toHaveAccessibleName(
      '1 portiere su 3, 3 difensori su 8, 0 centrocampisti su 8, 0 attaccanti su 6',
    );
  });
});
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

```bash
cd frontend && npx vitest run src/domain/LeagueBoard.test.tsx
```

Attesa: FAIL.

- [ ] **Step 3: Scrivere il componente**

`frontend/src/domain/LeagueBoard.tsx`:

```tsx
import type { ParticipantView, Role } from '../api/types';

const ORDER: Role[] = ['P', 'D', 'C', 'A'];

const SEGMENT: Record<Role, string> = {
  P: 'bg-accent',
  D: 'bg-positive',
  C: 'bg-[color-mix(in_oklch,var(--color-foreground)_45%,transparent)]',
  A: 'bg-[color-mix(in_oklch,var(--color-accent)_55%,transparent)]',
};

const NOUN: Record<Role, [string, string]> = {
  P: ['portiere', 'portieri'],
  D: ['difensore', 'difensori'],
  C: ['centrocampista', 'centrocampisti'],
  A: ['attaccante', 'attaccanti'],
};

/**
 * La barra dice a colpo d'occhio quanto e come una rosa e' piena. Il testo
 * equivalente non e' un ripiego per i lettori di schermo: e' la stessa
 * informazione detta a parole, ed e' cio' che permette di togliere la stringa
 * "1P 3D 0C 0A" dallo schermo senza perderla.
 */
function describe(p: ParticipantView): string {
  return ORDER.map((role) => {
    const filled = p.filledByRole[role];
    const total = p.slotsByRole[role];
    const [one, many] = NOUN[role];
    return `${filled} ${filled === 1 ? one : many} su ${total}`;
  }).join(', ');
}

export function LeagueBoard({ participants }: { participants: ParticipantView[] }) {
  const totalSlots = participants[0]
    ? ORDER.reduce((sum, r) => sum + participants[0].slotsByRole[r], 0)
    : 0;

  return (
    <section aria-labelledby="board-heading">
      <h2 id="board-heading" className="mb-3 text-sm text-muted-foreground">
        Chi ha cosa
      </h2>
      <ul className="space-y-2">
        {participants.map((p) => (
          <li
            key={p.id}
            data-testid={`manager-${p.id}`}
            data-me={p.me}
            className={`border p-3 ${p.me ? 'border-accent' : 'border-line'}`}
          >
            <div className="flex items-baseline justify-between">
              <span className="font-bold">{p.name}</span>
              <span
                data-testid={`budget-${p.id}`}
                className={`tnum w-exp font-bold ${p.me ? 'text-accent' : 'text-muted-foreground'}`}
              >
                {p.budgetRemaining}
              </span>
            </div>
            <div
              data-testid={`composition-${p.id}`}
              role="img"
              aria-label={describe(p)}
              className="mt-2 flex h-2 gap-0.5 bg-[color-mix(in_oklch,var(--color-foreground)_8%,transparent)]"
            >
              {ORDER.map((role) => (
                <span
                  key={role}
                  data-role={role}
                  className={SEGMENT[role]}
                  style={{
                    width: totalSlots
                      ? `${(p.filledByRole[role] / totalSlots) * 100}%`
                      : '0%',
                  }}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Eseguire il test e committare**

```bash
cd frontend && npx vitest run src/domain/LeagueBoard.test.tsx
cd /Users/luigidinuzzo/Progetti/FantaAgent
git add frontend/src/domain
git commit -m "Sostituisce '1P 3D 0C 0A' con una barra segmentata

La stringa grezza si legge; la barra si guarda. Il testo equivalente
dice la stessa cosa a parole, ed e' cio' che permette di toglierla dallo
schermo senza perdere l'informazione."
```

---

### Task 15: `BidPanel` — l'azione, e la sua attesa

**Files:**
- Create: `frontend/src/domain/BidPanel.tsx`
- Test: `frontend/src/domain/BidPanel.test.tsx`

**Interfaces:**
- Consumes: `ParticipantView[]`, e le callback della mutazione del Task 11.
- Produces: `<BidPanel suggestedPrice={number} participants={…} disabled={boolean} pending={boolean} error={string|null} onAssign={({participantId, price}) => void} />`

- [ ] **Step 1: Scrivere il test, che deve fallire**

`frontend/src/domain/BidPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ParticipantView } from '../api/types';
import { BidPanel } from './BidPanel';

const PARTICIPANTS: ParticipantView[] = [
  {
    id: 'anna', name: 'Anna', initial: 'A', me: true,
    budgetRemaining: 312, slotsRemaining: 17,
    filledByRole: { P: 1, D: 3, C: 0, A: 0 },
    slotsByRole: { P: 3, D: 8, C: 8, A: 6 },
  },
  {
    id: 'bruno', name: 'Bruno', initial: 'B', me: false,
    budgetRemaining: 289, slotsRemaining: 19,
    filledByRole: { P: 1, D: 2, C: 0, A: 0 },
    slotsByRole: { P: 3, D: 8, C: 8, A: 6 },
  },
];

function panel(overrides = {}) {
  const onAssign = vi.fn();
  render(
    <BidPanel
      suggestedPrice={47}
      participants={PARTICIPANTS}
      disabled={false}
      pending={false}
      error={null}
      onAssign={onAssign}
      {...overrides}
    />,
  );
  return onAssign;
}

describe('BidPanel', () => {
  it('propone il tetto come prezzo di partenza', () => {
    panel();
    expect(screen.getByLabelText('Prezzo')).toHaveValue(47);
  });

  it('aggiudica al partecipante scelto', async () => {
    const onAssign = panel();

    await userEvent.selectOptions(screen.getByLabelText('Aggiudica a'), 'bruno');
    await userEvent.click(screen.getByRole('button', { name: 'Aggiudica' }));

    expect(onAssign).toHaveBeenCalledWith({ participantId: 'bruno', price: 47 });
  });

  it("durante l'attesa il bottone lo dice e non si puo' ripremere", () => {
    panel({ pending: true });
    const button = screen.getByRole('button', { name: /Aggiudico/ });
    expect(button).toBeDisabled();
  });

  it("l'errore compare vicino al campo, col testo del server", () => {
    panel({ error: 'Anna ha solo 12 crediti di budget residuo' });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Anna ha solo 12 crediti di budget residuo',
    );
  });

  it('da stantio non si puo aggiudicare', () => {
    panel({ disabled: true });
    expect(screen.getByRole('button', { name: 'Aggiudica' })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

```bash
cd frontend && npx vitest run src/domain/BidPanel.test.tsx
```

Attesa: FAIL.

- [ ] **Step 3: Scrivere il componente**

`frontend/src/domain/BidPanel.tsx`:

```tsx
import { useEffect, useId, useState } from 'react';
import type { ParticipantView } from '../api/types';

export function BidPanel({
  suggestedPrice,
  participants,
  disabled,
  pending,
  error,
  onAssign,
}: {
  suggestedPrice: number;
  participants: ParticipantView[];
  disabled: boolean;
  pending: boolean;
  error: string | null;
  onAssign: (input: { participantId: string; price: number }) => void;
}) {
  const priceId = useId();
  const buyerId = useId();
  const errorId = useId();

  const [price, setPrice] = useState(suggestedPrice);
  const [participantId, setParticipantId] = useState(
    participants.find((p) => p.me)?.id ?? participants[0]?.id ?? '',
  );

  // Cambiando giocatore il prezzo torna al tetto di QUEL giocatore: lasciare il
  // numero precedente significherebbe partire dal tetto di un altro.
  useEffect(() => setPrice(suggestedPrice), [suggestedPrice]);

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onAssign({ participantId, price });
      }}
    >
      <div>
        <label htmlFor={priceId} className="block text-sm text-muted-foreground">
          Prezzo
        </label>
        <input
          id={priceId}
          type="number"
          min={1}
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          className="tnum mt-1 min-h-11 w-24 border border-line-strong bg-transparent px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        />
      </div>

      <div>
        <label htmlFor={buyerId} className="block text-sm text-muted-foreground">
          Aggiudica a
        </label>
        <select
          id={buyerId}
          value={participantId}
          onChange={(e) => setParticipantId(e.target.value)}
          className="mt-1 min-h-11 border border-line bg-transparent px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Il verbo del bottone e' lo stesso dell'esito: si preme Aggiudica e
          l'evento registrato e' un'aggiudicazione. */}
      <button
        type="submit"
        disabled={disabled || pending}
        className="min-h-11 bg-accent px-5 font-bold text-on-accent transition-opacity duration-200 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground"
      >
        {pending ? 'Aggiudico…' : 'Aggiudica'}
      </button>

      {error ? (
        <p id={errorId} role="alert" className="w-full text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
```

- [ ] **Step 4: Eseguire il test e committare**

```bash
cd frontend && npx vitest run src/domain/BidPanel.test.tsx
cd /Users/luigidinuzzo/Progetti/FantaAgent
git add frontend/src/domain
git commit -m "Aggiunge il pannello di aggiudicazione

Il bottone dice Aggiudico durante l'attesa e non si puo' ripremere:
niente aggiornamento ottimistico, si aspetta il fsync del registro.
L'errore del server compare accanto al campo che lo ha causato."
```

---

### Task 16: `ConnectionStatus` — quando il dato smette di essere vero

Lo stato che con Thymeleaf non può esistere, e che la separazione del frontend
introduce: la connessione cade, la pagina resta ferma, i numeri mentono in
silenzio.

**Files:**
- Create: `frontend/src/domain/ConnectionStatus.tsx`
- Create: `frontend/src/domain/AuctionAnnouncer.tsx`
- Test: `frontend/src/domain/ConnectionStatus.test.tsx`
- Test: `frontend/src/domain/AuctionAnnouncer.test.tsx`

**Interfaces:**
- Produces:
  - `<ConnectionStatus updatedAt={number|undefined} isError={boolean} now={number} />`
    — **visivo, non una live region.**
  - `isStale({updatedAt, isError, now}): boolean` e `STALE_AFTER_MS`, riusate
    dalla route per smorzare la scheda e disabilitare l'azione.
  - `<AuctionAnnouncer message={string|null} />` — l'**unica** `role="status"`
    della schermata — e `purchaseMessage(a: PurchaseAnnouncement): string`.

- [ ] **Step 1: Scrivere il test, che deve fallire**

`frontend/src/domain/ConnectionStatus.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConnectionStatus, STALE_AFTER_MS, isStale } from './ConnectionStatus';

const NOW = 1_700_000_000_000;

describe('isStale', () => {
  it('un dato appena arrivato non e stantio', () => {
    expect(isStale({ updatedAt: NOW - 1_000, isError: false, now: NOW })).toBe(false);
  });

  it('oltre la soglia diventa stantio', () => {
    expect(isStale({ updatedAt: NOW - STALE_AFTER_MS - 1, isError: false, now: NOW })).toBe(true);
  });

  it("un errore rende stantio anche un dato appena arrivato", () => {
    expect(isStale({ updatedAt: NOW, isError: true, now: NOW })).toBe(true);
  });

  it('senza alcun dato lo stato e stantio', () => {
    expect(isStale({ updatedAt: undefined, isError: false, now: NOW })).toBe(true);
  });
});

describe('ConnectionStatus', () => {
  it('in diretta lo dice', () => {
    render(<ConnectionStatus updatedAt={NOW - 2_000} isError={false} now={NOW} />);
    expect(screen.getByTestId('connection-status')).toHaveTextContent('In diretta');
  });

  it('quando e stantio dice da quanto', () => {
    render(<ConnectionStatus updatedAt={NOW - 72_000} isError now={NOW} />);
    expect(screen.getByTestId('connection-status')).toHaveTextContent(
      'Connessione persa, ultimo dato 1 min 12 s fa',
    );
  });

  it("non e' una live region: l'annuncio spetta ad AuctionAnnouncer", () => {
    render(<ConnectionStatus updatedAt={NOW} isError={false} now={NOW} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

```bash
cd frontend && npx vitest run src/domain/ConnectionStatus.test.tsx
```

Attesa: FAIL.

- [ ] **Step 3: Scrivere il componente**

`frontend/src/domain/ConnectionStatus.tsx`:

```tsx
/**
 * Dopo quanto un dato smette di poter essere creduto.
 *
 * <p>Il triplo dell'intervallo di aggiornamento (5 s): un solo giro saltato e'
 * una latenza, tre di fila sono una connessione che non c'e' piu'.
 */
export const STALE_AFTER_MS = 15_000;

export function isStale({
  updatedAt,
  isError,
  now,
}: {
  updatedAt: number | undefined;
  isError: boolean;
  now: number;
}): boolean {
  if (isError) return true;
  if (updatedAt === undefined) return true;
  return now - updatedAt > STALE_AFTER_MS;
}

function ago(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

export function ConnectionStatus({
  updatedAt,
  isError,
  now,
}: {
  updatedAt: number | undefined;
  isError: boolean;
  now: number;
}) {
  const stale = isStale({ updatedAt, isError, now });

  return (
    // Deliberatamente NON una live region. Ogni aggiudicazione cambia budget,
    // slot, composizione e disponibilita' insieme: se ogni pannello annunciasse
    // il proprio pezzo, un lettore di schermo riceverebbe quattro frasi in
    // competizione. L'unico annuncio della pagina e' AuctionAnnouncer.
    <p
      data-testid="connection-status"
      className={`flex items-center gap-2 text-sm ${
        stale ? 'text-accent' : 'text-muted-foreground'
      }`}
    >
      <span
        aria-hidden
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          stale ? 'bg-accent' : 'bg-positive'
        }`}
      />
      {stale
        ? `Connessione persa, ultimo dato ${
            updatedAt === undefined ? 'mai ricevuto' : `${ago(now - updatedAt)} fa`
          }`
        : 'In diretta'}
    </p>
  );
}
```

- [ ] **Step 4: Scrivere il test dell'annunciatore, che deve fallire**

`ConnectionStatus` è visivo. L'unico annuncio della pagina è questo, e dice una
frase di senso compiuto invece di un numero nudo — perché una singola
aggiudicazione cambia budget, slot, composizione e disponibilità nello stesso
istante, e un lettore di schermo non può inseguirli uno per uno.

`frontend/src/domain/AuctionAnnouncer.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuctionAnnouncer, purchaseMessage } from './AuctionAnnouncer';

describe('purchaseMessage', () => {
  it('dice chi ha preso chi, a quanto, e cosa resta a me', () => {
    expect(
      purchaseMessage({
        playerName: 'Bastoni',
        buyerName: 'Anna',
        price: 47,
        myBudgetRemaining: 265,
        mySlotsRemaining: 17,
      }),
    ).toBe(
      'Bastoni aggiudicato ad Anna per 47 crediti. Ti restano 265 crediti e 17 slot.',
    );
  });

  it("usa 'a' invece di 'ad' davanti a consonante", () => {
    expect(
      purchaseMessage({
        playerName: 'Gatti',
        buyerName: 'Bruno',
        price: 12,
        myBudgetRemaining: 253,
        mySlotsRemaining: 16,
      }),
    ).toContain('aggiudicato a Bruno');
  });

  it('accorda il singolare quando resta uno slot solo', () => {
    expect(
      purchaseMessage({
        playerName: 'Gatti',
        buyerName: 'Bruno',
        price: 12,
        myBudgetRemaining: 1,
        mySlotsRemaining: 1,
      }),
    ).toContain('Ti restano 1 credito e 1 slot.');
  });
});

describe('AuctionAnnouncer', () => {
  it("e' l'unica live region, ed e' atomica", () => {
    render(<AuctionAnnouncer message="Bastoni aggiudicato ad Anna per 47 crediti." />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-atomic', 'true');
    expect(region).toHaveTextContent('Bastoni aggiudicato ad Anna per 47 crediti.');
  });

  it('non ingombra lo schermo', () => {
    render(<AuctionAnnouncer message="qualcosa" />);
    expect(screen.getByRole('status')).toHaveClass('sr-only');
  });
});
```

- [ ] **Step 5: Eseguire e verificare il fallimento**

```bash
cd frontend && npx vitest run src/domain/AuctionAnnouncer.test.tsx
```

Attesa: FAIL — il modulo non esiste.

- [ ] **Step 6: Scrivere l'annunciatore**

`frontend/src/domain/AuctionAnnouncer.tsx`:

```tsx
export interface PurchaseAnnouncement {
  playerName: string;
  buyerName: string;
  price: number;
  myBudgetRemaining: number;
  mySlotsRemaining: number;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function purchaseMessage(a: PurchaseAnnouncement): string {
  // "ad Anna" ma "a Bruno": l'eufonica va davanti a vocale. Un annuncio letto
  // ad alta voce e' testo parlato, e va scritto come si parla.
  const preposition = /^[aeiou]/i.test(a.buyerName) ? 'ad' : 'a';
  return (
    `${a.playerName} aggiudicato ${preposition} ${a.buyerName} per ` +
    `${plural(a.price, 'credito', 'crediti')}. Ti restano ` +
    `${plural(a.myBudgetRemaining, 'credito', 'crediti')} e ` +
    `${plural(a.mySlotsRemaining, 'slot', 'slot')}.`
  );
}

/**
 * L'unica live region della schermata d'asta.
 *
 * <p>Una aggiudicazione cambia budget, slot, composizione della rosa e
 * disponibilita' del giocatore nello stesso istante. Annunciarli separatamente
 * darebbe quattro frasi in competizione, di cui nessuna comprensibile; un
 * badge che annuncia il numero nudo "265" e' anche peggio. Qui esce una frase
 * sola, e completa.
 */
export function AuctionAnnouncer({ message }: { message: string | null }) {
  return (
    <p role="status" aria-atomic="true" className="sr-only">
      {message ?? ''}
    </p>
  );
}
```

- [ ] **Step 7: Eseguire i test e committare**

```bash
cd frontend && npx vitest run src/domain
cd /Users/luigidinuzzo/Progetti/FantaAgent
git add frontend/src/domain
git commit -m "Dice quando il dato ha smesso di essere vero

Con Thymeleaf ogni pagina era resa dal server: cio' che si vedeva era
vero per costruzione. Con un frontend separato la connessione puo' cadere
senza che la pagina cambi, e allora i numeri mentono in silenzio.

ConnectionStatus e' visivo e AuctionAnnouncer e' l'unica live region:
una aggiudicazione cambia quattro valori insieme, e annunciarli
separatamente darebbe quattro frasi in competizione di cui nessuna
comprensibile."
```

---

### Task 17: La route, e il percorso critico end-to-end

**Files:**
- Create: `frontend/src/routes/AuctionRoute.tsx`
- Modify: `frontend/src/main.tsx`
- Create: `frontend/playwright.config.ts`
- Test: `frontend/e2e/critical-path.spec.ts`

**Interfaces:**
- Consumes: tutti i componenti e gli hook dei Task 10–16.

- [ ] **Step 1: Comporre la route**

`frontend/src/routes/AuctionRoute.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { AppShell } from '../AppShell';
import { ProblemError } from '../api/client';
import { useAssign, useAuctionState, usePhasePlayers, useValuation } from '../api/hooks';
import { AuctionAnnouncer, purchaseMessage } from '../domain/AuctionAnnouncer';
import { BidPanel } from '../domain/BidPanel';
import { ConnectionStatus, isStale } from '../domain/ConnectionStatus';
import { LeagueBoard } from '../domain/LeagueBoard';
import { PlayerDecisionCard } from '../domain/PlayerDecisionCard';
import { PlayerTable } from '../domain/PlayerTable';

export function AuctionRoute() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Un tick al secondo: serve solo a far invecchiare il "da quanto tempo".
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const state = useAuctionState();
  const phase = usePhasePlayers(0);
  const valuation = useValuation(selectedId);
  const assign = useAssign();

  const stale = isStale({
    updatedAt: state.dataUpdatedAt || undefined,
    isError: state.isError,
    now,
  });

  const assignError =
    assign.error instanceof ProblemError ? assign.error.detail : null;

  // L'annuncio si compone DOPO la conferma del server, dallo stato appena
  // riletto: e' la stessa disciplina del bottone, detta a parole. Comporlo dai
  // valori inviati direbbe cosa si e' chiesto, non cosa e' successo.
  const [announcement, setAnnouncement] = useState<string | null>(null);
  useEffect(() => {
    const last = assign.data;
    if (!last || !state.data) return;
    const me = state.data.participants.find((p) => p.me);
    const buyer = state.data.participants.find((p) => p.id === last.participantId);
    if (!me || !buyer) return;
    setAnnouncement(
      purchaseMessage({
        playerName: valuation.data?.name ?? last.playerId,
        buyerName: buyer.name,
        price: last.price,
        myBudgetRemaining: me.budgetRemaining,
        mySlotsRemaining: me.slotsRemaining,
      }),
    );
  }, [assign.data, state.data, valuation.data?.name]);

  return (
    <AppShell
      slotStatus={
        <ConnectionStatus
          updatedAt={state.dataUpdatedAt || undefined}
          isError={state.isError}
          now={now}
        />
      }
    >
      <AuctionAnnouncer message={announcement} />
      <div className="grid gap-5 lg:grid-cols-[1fr_16rem]">
        <div>
          {valuation.data ? (
            <PlayerDecisionCard valuation={valuation.data} stale={stale}>
              <BidPanel
                suggestedPrice={valuation.data.maxBid}
                participants={state.data?.participants ?? []}
                disabled={stale}
                pending={assign.isPending}
                error={assignError}
                onAssign={({ participantId, price }) =>
                  assign.mutate({ playerId: valuation.data!.playerId, participantId, price })
                }
              />
            </PlayerDecisionCard>
          ) : (
            <p className="border border-dashed border-line p-6 text-sm text-muted-foreground">
              Scegli un giocatore dalla tabella per vedere quanto conviene spendere.
            </p>
          )}

          <div className="mt-5">
            <PlayerTable
              rows={phase.data?.rows ?? []}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
        </div>

        <LeagueBoard participants={state.data?.participants ?? []} />
      </div>
    </AppShell>
  );
}
```

`frontend/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryProvider } from './api/QueryProvider';
import { setAuctionContext } from './api/client';
import './index.css';
import { AuctionRoute } from './routes/AuctionRoute';

// In questo sotto-progetto la lega e' una sola e l'asta e' quella aperta sul
// server. Il sotto-progetto 3 le prendera' dalla sessione dell'utente.
setAuctionContext({
  leagueId: import.meta.env.VITE_LEAGUE_ID ?? 'default',
  auctionId: import.meta.env.VITE_AUCTION_ID ?? 'corrente',
});

document.documentElement.classList.add('dark');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <AuctionRoute />
    </QueryProvider>
  </StrictMode>,
);
```

- [ ] **Step 2: Configurare Playwright**

```bash
cd frontend && npm i -D @playwright/test && npx playwright install chromium
```

`frontend/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:5173' },
  // Il backend NON viene avviato da qui: va gia' in esecuzione, con un'asta
  // aperta. E' una precondizione dichiarata, non un dimenticanza — avviarlo
  // dentro Playwright significherebbe creare aste vere a ogni esecuzione.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 3: Scrivere il test del percorso critico**

`frontend/e2e/critical-path.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

/**
 * Precondizione: il backend gira su :8080 con un'asta aperta e almeno un
 * giocatore libero nella fase corrente.
 *
 *   ./run.sh   (in un altro terminale)
 *
 * Questo test esiste perche' il README ammette che la suite Java non esegue
 * JavaScript ne' CSS, e che piu' di un difetto e' uscito esattamente da li'.
 * Spostando l'interfaccia su React, quella zona cieca diventerebbe la
 * maggioranza del prodotto.
 */
test('cercare, valutare, aggiudicare', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('connection-status')).toContainText('In diretta');

  const firstRow = page.locator('tbody tr').first();
  const playerName = await firstRow.locator('button').innerText();
  await firstRow.locator('button').click();

  const card = page.getByTestId('decision-card');
  await expect(card).toContainText(playerName);
  await expect(page.getByTestId('max-bid')).not.toBeEmpty();

  const budgetBefore = await page.getByTestId(/^budget-/).first().innerText();

  await page.getByLabel('Prezzo').fill('1');
  await page.getByRole('button', { name: 'Aggiudica' }).click();

  // Il budget cambia solo DOPO che il server ha confermato: e' la prova che
  // non c'e' aggiornamento ottimistico.
  await expect(page.getByTestId(/^budget-/).first()).not.toHaveText(budgetBefore);

  // E il giocatore aggiudicato sparisce dai liberi.
  await expect(page.locator('tbody tr button', { hasText: playerName })).toHaveCount(0);

  // L'unica live region della pagina dice cosa e' successo, per intero.
  await expect(page.getByRole('status')).toContainText(
    new RegExp(`${playerName} aggiudicato a.+per 1 credito\\. Ti restano `),
  );
});

test('a connessione caduta l azione si disabilita', async ({ page }) => {
  await page.goto('/');
  await page.locator('tbody tr').first().locator('button').click();
  await expect(page.getByRole('button', { name: 'Aggiudica' })).toBeEnabled();

  await page.route('**/api/**', (route) => route.abort());

  await expect(page.getByTestId('connection-status')).toContainText('Connessione persa', {
    timeout: 30_000,
  });
  await expect(page.getByRole('button', { name: 'Aggiudica' })).toBeDisabled();
  await expect(page.getByTestId('decision-card')).toHaveAttribute('data-stale', 'true');
});
```

- [ ] **Step 4: Eseguire tutta la verifica**

In un terminale:

```bash
./run.sh
```

Nell'altro:

```bash
cd frontend && npm run test && npx playwright test
```

Attesa: PASS su entrambi. Se il primo test Playwright fallisce perché non c'è
un'asta aperta, aprine una dalla home su <http://localhost:8080> e riprova: è
la precondizione dichiarata, non un difetto.

- [ ] **Step 5: Verificare che il backend sia ancora integro**

```bash
cd /Users/luigidinuzzo/Progetti/FantaAgent && mvn -q test
```

Attesa: PASS, suite completa. Il frontend Thymeleaf funziona ancora e i suoi 108
assert sull'HTML sono ancora verdi: è la condizione per considerare chiusa la
tappa 3.

- [ ] **Step 6: Commit**

```bash
git add frontend
git commit -m "Compone la schermata d'asta e ne verifica il percorso critico

Playwright esiste perche' il README ammette che la suite Java non esegue
JavaScript ne' CSS, e che piu' di un difetto e' uscito da li'. Spostando
l'interfaccia su React quella zona cieca diventerebbe la maggioranza del
prodotto.

Il test controlla che il budget cambi solo DOPO la conferma del server:
e' la prova che non c'e' aggiornamento ottimistico."
```

---

## Dove si arriva, e cosa resta

Alla fine del Task 17 esistono due frontend funzionanti sullo stesso backend. La
schermata d'asta React copre il percorso critico — cercare, valutare,
aggiudicare — e il Thymeleaf continua a servire tutto il resto, con i suoi test
ancora verdi.

**Le tappe 4–6 avranno il proprio piano:** battitore e proiezione, home e
riepilogo e impostazioni, e infine la rimozione dei template. Nessuna di esse va
iniziata prima che questo piano sia completo e verificato.

### Il frontend impacchettato non è ancora servito

Il profilo Maven `prod` costruisce il frontend e ne copia il risultato dentro il
jar. Quel risultato **non è raggiungibile da nessuna URL**: `HomeController` mappa
`/` e `AuctionController` mappa `/asta`, e in Spring MVC una request mapping vince
sempre sul gestore della pagina di benvenuto, che è ciò che servirebbe
`index.html`. Non c'è nemmeno un fallback SPA. Chi esegue `mvn -Pprod package`
oggi paga per intero il costo della build npm e ottiene un jar che contiene
un'applicazione che nessuno può aprire.

**È una decisione, non una dimenticanza.** Servire il frontend adesso significa
decidere come convive con le sei rotte Thymeleaf ancora vive, e quella convivenza
è esattamente ciò che la tappa 6 risolve togliendole di mezzo. Un prefisso
provvisorio — `/app/**` — creerebbe una URL destinata a morire nel giro di poche
tappe, e con essa i segnalibri e le abitudini di chi la usa.

Il difetto vero era il silenzio: nulla, né qui né nel README, diceva che il jar
prodotto contiene un frontend inerte. Ora lo dicono entrambi. Fino alla tappa 6 il
frontend si sviluppa con `npm run dev` e l'asta si fa dalle schermate Thymeleaf;
la tappa 6 rimuove i template e mette il frontend alla radice.
