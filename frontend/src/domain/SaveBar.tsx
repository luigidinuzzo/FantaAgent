import { BUTTON_PRIMARY, BUTTON_SECONDARY } from './controls';

/** L'altezza della barra e lo spazio che il contenuto lascia sotto di se'. */
export const SAVE_BAR_H = 'h-18';
export const SAVE_BAR_SPACE = 'pb-24';
/**
 * La larghezza del contenuto delle impostazioni: la pagina ({@code SettingsLayout})
 * e il contenuto della barra, che cosi' ha i bottoni al bordo destro della pagina.
 */
export const SETTINGS_W = 'max-w-[66rem]';

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
      <div className={`mx-auto box-content flex h-full ${SETTINGS_W} items-center gap-3 px-4 md:px-6`}>
        {/* Va a capo, al piu' su due righe: tagliata, la frase d'errore sul telefono
            stretto si riduceva a «1 errore: …». */}
        <p className="line-clamp-2 min-w-0 flex-1 text-sm leading-snug">
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
        {/* Sotto sm il bottone dice solo «Salva», per lasciare spazio alla frase; il
            nome per chi ascolta resta quello intero. */}
        <button type="button" disabled={!dirty || pending} onClick={onSave} aria-label={pending ? undefined : saveLabel}
          className={`${BUTTON_PRIMARY} px-5`}>
          {pending ? 'Salvo…' : (
            <>
              <span className="sm:hidden">Salva</span>
              <span className="max-sm:hidden">{saveLabel}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
