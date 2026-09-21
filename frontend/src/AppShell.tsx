import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PitchLines } from './domain/PitchLines';
import { HomeSectionNav, type HomeSection } from './domain/SideNav';
import { Wordmark } from './domain/Wordmark';

/**
 * La barra comune a ogni schermata: banner, nome, navigazione, e lo slot di stato
 * di chi la usa. Prende tre forme secondo {@code chrome}.
 *
 * <p><b>La barra dell'asta porta solo il marchio.</b> Durante la serata la barra
 * superiore non elenca piu' le sezioni ne' ripete il nome dell'asta: resta il
 * marchio, che riporta alla home, e i pulsanti icona a destra ({@code slotActions})
 * — proiezione, annulla, impostazioni. Le destinazioni non spariscono, cambiano
 * porta: /impostazioni si raggiunge dall'ingranaggio, /proiezione dal suo pulsante,
 * /asta dalla home, e la home dal marchio o dal pulsante «Home» accanto. Chi aggiunge una rotta deve darle una porta da qualche parte,
 * non necessariamente qui.
 *
 * <p><b>La barra laterale e' un'altra cosa.</b> Vive solo sulla home, dove le sue
 * due voci — Asta e Profilo — cambiano il contenuto senza cambiare pagina (vedi
 * {@code HomeSectionNav}). Ogni altra schermata porta la barra compatta in alto. Il
 * nome porta comunque alla home in entrambe le forme.
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
  /** Solo chrome="side": la sezione evidenziata nella barra laterale. */
  section?: HomeSection;
  /**
   * Solo chrome="side": lo monta la home, dove la sezione cambia il contenuto senza
   * cambiare pagina. Senza, la barra laterale non mostra nessuna voce.
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
            {/* Le due voci esistono solo dove servono a qualcosa: sono bottoni che
                cambiano sezione, e senza chi ascolta quel cambio non avrebbero
                niente da fare. Oggi le monta la sola home. */}
            {onSectionChange ? (
              <HomeSectionNav current={section} onChange={onSectionChange} />
            ) : null}
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
              <>
                <Link
                  to="/"
                  className="flex min-h-11 items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <Wordmark size="md" />
                </Link>
                {/* Il marchio porta gia' alla home, ma solo chi ha imparato che i
                    loghi si cliccano lo sa: accanto c'e' la stessa destinazione
                    detta a parole. */}
                <Link
                  to="/"
                  className="flex min-h-11 items-center rounded-full border border-line-strong px-4 font-bold hover:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  Home
                </Link>
              </>
            ) : (
              // La proiezione resta senza chrome: "FantaAgent" e' testo
              // semplice, non un link — la schermata non mostra nessuna
              // navigazione, nemmeno il nome come porta verso la home.
              <Wordmark size="md" />
            )}
            {/* Anche il gruppo di destra sa andare a capo: su un telefono i pulsanti
                icona piu' lo stato di connessione superano la larghezza dello schermo,
                e senza questo la pagina intera scorreva di lato. */}
            <div className="ml-auto flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
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
