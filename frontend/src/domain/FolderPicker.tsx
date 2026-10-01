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
        className={`${BUTTON_SECONDARY} px-5`}>
        Scegli la cartella
      </button>
      <span className="min-w-0 break-words text-sm text-muted-foreground">
        {picked ? <span className="font-medium text-foreground">{picked}</span> : 'Nessuna cartella scelta'}
      </span>
    </div>
  );
}
