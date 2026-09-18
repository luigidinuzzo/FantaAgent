import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PitchLines } from './domain/PitchLines';
import { HomeSectionNav, SectionLinks, type HomeSection } from './domain/SideNav';
import { Wordmark } from './domain/Wordmark';

/**
 * La barra comune a ogni schermata: banner, nome, navigazione, e lo slot di stato
 * di chi la usa. Prende tre forme secondo {@code chrome}.
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
 * caso. La barra superiore ({@code chrome="top"}) e' quella che le collega tutte;
 * la barra laterale ha le sue due voci (sotto).
 *
 * <p><b>La barra laterale e' un'altra cosa.</b> La home (e le impostazioni, che
 * ne sono il seguito) mostrano Asta e Profilo, non le sezioni dell'asta: vedi
 * {@code HomeSectionNav}. Il nome porta comunque alla home in entrambe le forme.
 *
 * <p><b>Pannelli pieni.</b> Header e barra laterale sono pannelli
 * ({@code panel}): nessun testo poggia direttamente sulle linee del campo.
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
  section = 'asta',
  onSectionChange,
}: {
  children: ReactNode;
  /**
   * "side": barra laterale con Asta e Profilo (home, impostazioni). "top": barra
   * compatta dell'asta, con le stesse destinazioni in orizzontale. "none": la
   * proiezione, senza nessuna navigazione.
   */
  chrome: 'side' | 'top' | 'none';
  slotStatus?: ReactNode;
  /** I pulsanti icona dell'asta. Renderizzato solo con chrome="top": vedi sotto. */
  slotActions?: ReactNode;
  /** Titolo mostrato nella barra superiore, oltre al nome. */
  title?: string;
  /** Solo chrome="side": la sezione evidenziata nella barra laterale. */
  section?: HomeSection;
  /**
   * Solo chrome="side": presente sulla home, dove la sezione cambia il contenuto
   * senza cambiare pagina. Assente altrove, dove le voci portano alla home.
   */
  onSectionChange?: (section: HomeSection) => void;
}) {
  // slotActions con chrome !== 'top' non va nascosto con CSS: non va reso affatto.
  // Un pulsante nascosto alla vista resta comunque raggiungibile da tastiera e dai
  // lettori di schermo, su una schermata che non lo prevede.
  const actions = chrome === 'top' ? slotActions : null;

  return (
    <div className="min-h-dvh bg-background text-foreground font-sans">
      {/* Il campo e' uno solo per tutte le schermate, proiezione compresa: il
          testo sta nei pannelli, quindi le linee non devono piu' farsi
          discrete in un posto e visibili in un altro. */}
      {/* Con la barra laterale il campo comincia dove finisce la barra: su tutta
          la finestra ne finiva sotto un pezzo, e la metà campo cadeva spostata
          rispetto alle card. md:left-80 va tenuto uguale a md:w-80 della barra
          qui sotto; sul telefono la barra sta sopra e il campo torna intero. */}
      <PitchLines className={chrome === 'side' ? 'inset-y-0 right-0 left-0 md:left-80' : 'inset-0'} />

      {chrome === 'side' && (
        <div className="flex min-h-dvh flex-col md:flex-row">
          <header
            role="banner"
            // md:sticky + md:h-dvh: scorrendo una pagina lunga (le impostazioni) il
            // marchio e le due voci restano al loro posto invece di uscire dallo
            // schermo. self-start toglie lo stiramento del flex, che impedirebbe allo
            // sticky di attaccarsi; overflow-y-auto serve alle barre piu' alte della
            // finestra. Sul telefono la barra sta sopra e scorre col contenuto.
            className="relative z-10 flex shrink-0 flex-col border-b border-panel-border bg-surface px-4 py-4 text-sm md:sticky md:top-0 md:h-dvh md:w-80 md:self-start md:overflow-y-auto md:border-b-0 md:border-r md:py-6"
          >
            <Link
              to="/"
              className="mb-4 flex min-h-11 items-center md:mb-8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Wordmark size="lg" />
            </Link>
            <HomeSectionNav current={section} onChange={onSectionChange} />
            <div className="mt-auto flex flex-col items-start gap-4">{slotStatus}</div>
          </header>
          <main role="main" className="relative z-10 min-w-0 flex-1 p-4 md:p-6">
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
            className="relative z-10 flex flex-wrap items-center gap-4 border-b border-panel-border bg-surface px-4 py-3 text-sm"
          >
            {chrome === 'top' ? (
              <Link
                to="/"
                className="flex min-h-11 items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <Wordmark size="md" />
              </Link>
            ) : (
              // La proiezione resta senza chrome: "FantaAgent" e' testo
              // semplice, non un link — la schermata non mostra nessuna
              // navigazione, nemmeno il nome come porta verso la home.
              <Wordmark size="md" />
            )}
            {chrome === 'top' && title ? <span className="font-bold">{title}</span> : null}
            {chrome === 'top' ? <SectionLinks /> : null}
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
