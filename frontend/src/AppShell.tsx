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
          className="flex min-h-[var(--header-h)] items-center gap-2 border-b border-panel-border bg-bar px-4 text-sm max-sm:flex-wrap max-sm:py-1.5 sm:gap-4"
        >
          {chrome === 'top' ? (
            <Link to="/" className={`flex min-h-11 shrink-0 items-center ${FOCUS_RING}`}>
              <Wordmark size="bar" />
            </Link>
          ) : (
            // La proiezione: «FantaAgent» e' testo semplice, non un collegamento.
            <Wordmark size="bar" />
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
                  className={`flex min-h-11 min-w-0 items-center gap-1 rounded-lg px-2 text-muted-foreground hover:text-foreground max-sm:min-w-11 max-sm:justify-center ${FOCUS_RING}`}
                >
                  {/* Sul telefono, dove e' il solo passo in vista, il passo e' la
                      sola freccia: il nome resta per chi ascolta (sr-only, non
                      tolto), e la freccia da sola tiene comunque il bersaglio a
                      44px. */}
                  <span aria-hidden="true" className="sm:hidden">‹</span>
                  <span className="truncate max-sm:sr-only">{step.label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
