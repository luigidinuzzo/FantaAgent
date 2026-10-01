import type { ReactNode } from 'react';
import { FOCUS_RING } from './controls';
import { PageHeader } from './PageHeader';
import { SAVE_BAR_SPACE, SETTINGS_W } from './SaveBar';
import { useActiveSection } from './useActiveSection';

export interface SettingsSection { id: string; label: string; shortLabel?: string }

/**
 * Lo schema comune di regole, impostazioni dell'asta e profilo. Da lg l'indice a
 * sinistra, fermo, e il contenuto largo fino a 48rem; sotto lg l'indice e' una
 * fila sotto la barra in alto, ferma, con le etichette corte: si stringe, non
 * scorre di lato. Scorre la pagina, non un riquadro. Se c'e' la barra di
 * salvataggio, in fondo il contenuto le lascia lo spazio.
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
    <div className={`mx-auto w-full ${SETTINGS_W}`}>
      <PageHeader title={title} context={context} />
      <div className="lg:grid lg:grid-cols-[14rem_minmax(0,48rem)] lg:gap-x-8">
        {/* Un solo punto di riferimento «Sezioni» con le due forme dell'indice: la
            fila del telefono (lg:hidden) e l'elenco del computer (max-lg:hidden). Sotto
            lg e' il nav a restare fermo: il suo blocco e' la colonna intera, non la
            sola fila. */}
        <nav aria-label="Sezioni" className="max-lg:sticky max-lg:top-[var(--header-h)] max-lg:z-10 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:self-start">
          <div data-testid="settings-index-phone"
            className="-mx-4 mb-4 flex gap-1 border-b border-panel-border bg-background px-4 py-1 md:-mx-6 md:px-6 lg:hidden">
            {sections.map((s) => link(s, true))}
          </div>
          <ol className="flex flex-col gap-1 max-lg:hidden">
            {sections.map((s) => <li key={s.id}>{link(s, false)}</li>)}
          </ol>
        </nav>
        {/* Ogni sezione ha scroll-mt-[calc(var(--header-h)+4rem)]: il link
            dell'indice la porta sotto la barra e la fila ferma, non dietro. */}
        <div data-testid="settings-content" className={`flex min-w-0 flex-col gap-6 ${saveBar ? SAVE_BAR_SPACE : ''}`}>
          {children}
          {footer}
        </div>
      </div>
      {saveBar}
    </div>
  );
}
