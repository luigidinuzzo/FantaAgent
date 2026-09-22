import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PitchLines } from './domain/PitchLines';
import { Wordmark } from './domain/Wordmark';

/**
 * La barra comune a ogni schermata: marchio, navigazione, e lo slot di stato di chi
 * la usa. Due forme secondo {@code chrome}.
 *
 * <p><b>Una barra sola, in alto, su tutte le pagine.</b> Prima la home aveva una
 * barra laterale e le altre pagine questa: due modi di muoversi nello stesso
 * prodotto. In alto e non di lato perche' all'asta la larghezza serve alle tre
 * colonne e alle rose, e una colonna fissa di navigazione gliela toglieva.
 *
 * <p>A sinistra il marchio e «Le mie aste», entrambi verso la home — il marchio solo
 * per chi sa che i loghi si cliccano, la voce per tutti gli altri. Sulla home la voce
 * dice di essere la pagina corrente. A destra i pulsanti della schermata
 * ({@code slotActions}: all'asta proiezione, annulla, impostazioni) e lo stato.
 *
 * <p><b>Pannelli pieni.</b> La barra e' un pannello: nessun testo poggia
 * direttamente sulle linee del campo.
 *
 * <p><b>La proiezione resta senza chrome.</b> E' una seconda schermata pensata per
 * un proiettore: il suo vincolo permanente e' zero pulsanti e zero caselle di
 * testo. {@code chrome="none"} fa sparire la navigazione e il nome-come-link,
 * lasciando "FantaAgent" come semplice testo.
 */
export function AppShell({
  children,
  chrome,
  slotStatus,
  slotActions,
}: {
  children: ReactNode;
  /** "top": la barra con la navigazione. "none": la proiezione, senza navigazione. */
  chrome: 'top' | 'none';
  slotStatus?: ReactNode;
  /** I pulsanti della schermata. Renderizzato solo con chrome="top": vedi sotto. */
  slotActions?: ReactNode;
}) {
  // slotActions con chrome !== 'top' non va nascosto con CSS: non va reso affatto.
  // Un pulsante nascosto alla vista resta comunque raggiungibile da tastiera e dai
  // lettori di schermo, su una schermata che non lo prevede.
  const actions = chrome === 'top' ? slotActions : null;
  const onHome = useLocation().pathname === '/';

  return (
    <div className="min-h-dvh bg-background text-foreground font-sans">
      {/* Il campo e' uno solo per tutte le schermate, proiezione compresa: il
          testo sta nei pannelli, quindi le linee non devono farsi discrete in un
          posto e visibili in un altro. Comincia sotto la barra: dietro, la linea
          di fondo sarebbe coperta. Identico su ogni pagina: stessa tinta, e la
          barra ha su tutte la stessa altezza minima (--header-h), cosi' il campo
          parte sempre dalla stessa quota. */}
      <PitchLines className="inset-x-0 bottom-0 top-[var(--header-h)]" />

      {/* Ferma in cima mentre la pagina scorre: su una pagina lunga (le
          impostazioni, le rose) marchio, «Le mie aste» e i pulsanti dell'asta non
          devono uscire dallo schermo. z-30: sopra i pannelli e i menu che le
          scorrono sotto. */}
      <header
        role="banner"
        className="sticky top-0 z-30 flex min-h-[var(--header-h)] flex-wrap items-center gap-4 border-b border-panel-border bg-surface px-4 py-3 text-sm"
      >
        {chrome === 'top' ? (
          <>
            <Link
              to="/"
              className="flex min-h-11 items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Wordmark size="md" />
            </Link>
            {/* La stessa destinazione del marchio, detta a parole. Sulla home e' la
                pagina corrente: lo dice aria-current e lo mostra il giallo, come le
                voci selezionate in tutta l'app. Sul telefono no: la barra deve stare
                su due righe, e il marchio accanto porta gia' alla home. */}
            <Link
              to="/"
              aria-current={onHome ? 'page' : undefined}
              className={`flex min-h-11 items-center rounded-full px-4 font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent max-sm:hidden ${
                onHome ? 'bg-accent text-on-accent' : 'border border-line-strong hover:bg-line'
              }`}
            >
              Le mie aste
            </Link>
          </>
        ) : (
          // La proiezione resta senza chrome: "FantaAgent" e' testo semplice, non
          // un link — la schermata non mostra nessuna navigazione.
          <Wordmark size="md" />
        )}
        {/* Sul telefono: marchio e stato sulla prima riga, le azioni tutte insieme
            sulla seconda, a tutta larghezza. Da sm in su tutto in fila, con lo
            stato in fondo a destra. */}
        <div className="ml-auto sm:order-last sm:ml-0">{slotStatus}</div>
        {actions ? (
          <div className="flex items-center gap-2 max-sm:w-full max-sm:justify-between sm:ml-auto sm:gap-4">
            {actions}
          </div>
        ) : null}
      </header>
      <main role="main" className="relative z-10 p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
