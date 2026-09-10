import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * Le tre sezioni che la barra collega, oltre alla home a cui porta il nome. Non
 * la proiezione: quella si apre solo dal collegamento dedicato in AuctionRoute
 * (target="_blank", verso il secondo schermo), non da qui.
 */
const SECTIONS: Array<{ to: string; label: string }> = [
  { to: '/asta', label: 'Asta' },
  { to: '/riepilogo', label: 'Riepilogo' },
  { to: '/impostazioni', label: 'Impostazioni' },
];

/**
 * La barra comune a ogni schermata: banner, nome, navigazione, e lo slot di stato
 * di chi la usa.
 *
 * <p><b>Perche' la navigazione vive qui.</b> Due revisioni finali consecutive hanno
 * trovato lo stesso difetto strutturale — "una rotta aggiunta e nessuno che la
 * collega": /proiezione alla tappa 4 (corretto con un link isolato dentro
 * AuctionRoute), /riepilogo alla tappa 5 (nessun link da nessuna parte). Un terzo
 * link isolato per la prossima rotta sarebbe lo stesso difetto una terza volta.
 * AppShell e' l'unico elemento che OGNI schermata condivide — e' gia' qui che vive
 * {@code role="banner"} e lo slot di stato — quindi e' qui che la navigazione va
 * tenuta: una rotta nuova si aggiunge alla lista {@link SECTIONS} (e a
 * {@code router.tsx}), non a un'altra schermata a caso.
 *
 * <p><b>La proiezione resta senza chrome.</b> E' una seconda schermata pensata per
 * un proiettore: il suo vincolo permanente e' zero pulsanti e zero caselle di
 * testo. Un link e' {@code role="link"}, non {@code role="button"}, ma la
 * proiezione non deve mostrare comunque nessuna navigazione — {@code nav={false}}
 * fa sparire sia la barra dei link sia il nome-come-link, lasciando "FantaAgent"
 * come semplice testo.
 */
export function AppShell({
  children,
  slotStatus,
  nav = true,
}: {
  children: ReactNode;
  slotStatus?: ReactNode;
  /** false sulla sola /proiezione: vedi il commento sopra. */
  nav?: boolean;
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground font-sans">
      <header
        role="banner"
        className="flex items-center gap-4 border-b border-line-strong px-4 py-3 text-sm"
      >
        {nav ? (
          <Link
            to="/"
            className="w-exp flex min-h-11 items-center font-extrabold tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            FantaAgent
          </Link>
        ) : (
          <span className="w-exp font-extrabold tracking-tight">FantaAgent</span>
        )}

        {nav ? (
          <nav aria-label="Sezioni" className="flex items-center gap-4 font-bold">
            {SECTIONS.map((s) => (
              <Link
                key={s.to}
                to={s.to}
                className="flex min-h-11 items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                {s.label}
              </Link>
            ))}
          </nav>
        ) : null}

        <div className="ml-auto flex items-center gap-4">{slotStatus}</div>
      </header>
      <main role="main" className="p-4">
        {children}
      </main>
    </div>
  );
}
