import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PitchLines } from './domain/PitchLines';
import { SectionLinks } from './domain/SideNav';

/**
 * La barra comune a ogni schermata: banner, nome, navigazione, e lo slot di stato
 * di chi la usa. Prende tre forme secondo {@code chrome}, ma la navigazione che
 * collegano e' sempre la stessa (vedi sotto).
 *
 * <p><b>Perche' la navigazione vive qui.</b> Due revisioni finali consecutive hanno
 * trovato lo stesso difetto strutturale — "una rotta aggiunta e nessuno che la
 * collega": /proiezione alla tappa 4 (corretto con un link isolato dentro
 * AuctionRoute), /riepilogo alla tappa 5 (nessun link da nessuna parte). Un terzo
 * link isolato per la prossima rotta sarebbe lo stesso difetto una terza volta.
 * AppShell e' l'unico elemento che OGNI schermata condivide — e' gia' qui che vive
 * {@code role="banner"} e lo slot di stato — quindi e' qui che la navigazione va
 * tenuta: una rotta nuova si aggiunge alla lista {@link SECTIONS} in
 * {@code domain/SideNav.tsx} (e a {@code router.tsx}), non a un'altra schermata a
 * caso. {@code SectionLinks} e' un solo elenco, reso in due forme
 * ({@code chrome="side"} verticale, {@code chrome="top"} orizzontale): due elenchi
 * sarebbero due cose da tenere d'accordo.
 *
 * <p><b>La proiezione resta senza chrome.</b> E' una seconda schermata pensata per
 * un proiettore: il suo vincolo permanente e' zero pulsanti e zero caselle di
 * testo. Un link e' {@code role="link"}, non {@code role="button"}, ma la
 * proiezione non deve mostrare comunque nessuna navigazione — {@code chrome="none"}
 * fa sparire sia la barra dei link sia il nome-come-link, lasciando "FantaAgent"
 * come semplice testo.
 */
export function AppShell({
  children,
  chrome,
  slotStatus,
  slotActions,
  title,
}: {
  children: ReactNode;
  /**
   * "side": barra laterale (home, asta, impostazioni). "top": barra
   * compatta dell'asta, con le stesse destinazioni in orizzontale. "none": la
   * proiezione, senza nessuna navigazione.
   */
  chrome: 'side' | 'top' | 'none';
  slotStatus?: ReactNode;
  /** I pulsanti icona dell'asta. Renderizzato solo con chrome="top": vedi sotto. */
  slotActions?: ReactNode;
  /** Titolo mostrato nella barra superiore, oltre al nome. */
  title?: string;
}) {
  // slotActions con chrome !== 'top' non va nascosto con CSS: non va reso affatto.
  // Un pulsante nascosto alla vista resta comunque raggiungibile da tastiera e dai
  // lettori di schermo, su una schermata che non lo prevede.
  const actions = chrome === 'top' ? slotActions : null;

  return (
    <div className="min-h-dvh bg-background text-foreground font-sans">
      <PitchLines variant="app" />

      {chrome === 'side' && (
        <div className="flex">
          <header
            role="banner"
            className="relative z-10 flex w-56 flex-col border-r border-line px-4 py-6 text-sm"
          >
            <Link
              to="/"
              className="mb-6 flex min-h-11 items-center font-extrabold tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              FantaAgent
            </Link>
            <SectionLinks orientation="vertical" />
            <div className="mt-auto flex flex-col items-start gap-4">{slotStatus}</div>
          </header>
          <main role="main" className="relative z-10 flex-1 p-6">
            {children}
          </main>
        </div>
      )}

      {/* "top" e "none" condividono lo stesso <header> e lo stesso <main> —
          divergono solo nel contenuto della barra, non nella sua forma.
          "side" resta per conto suo qui sopra: e' genuinamente diverso
          (colonna a larghezza fissa, mt-auto, main dentro lo stesso
          contenitore del flex), non la stessa forma con contenuti diversi. */}
      {chrome !== 'side' && (
        <>
          <header
            role="banner"
            className="relative z-10 flex items-center gap-4 border-b border-line-strong px-4 py-3 text-sm"
          >
            {chrome === 'top' ? (
              <Link
                to="/"
                className="flex min-h-11 items-center font-extrabold tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                FantaAgent
              </Link>
            ) : (
              // La proiezione resta senza chrome: "FantaAgent" e' testo
              // semplice, non un link — la schermata non mostra nessuna
              // navigazione, nemmeno il nome come porta verso la home.
              <span className="font-extrabold tracking-tight">FantaAgent</span>
            )}
            {chrome === 'top' && title ? <span className="font-bold">{title}</span> : null}
            {chrome === 'top' ? <SectionLinks orientation="horizontal" /> : null}
            <div className="ml-auto flex items-center gap-4">
              {actions}
              {slotStatus}
            </div>
          </header>
          <main role="main" className="relative z-10 p-4">
            {children}
          </main>
        </>
      )}
    </div>
  );
}
