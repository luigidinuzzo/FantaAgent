import { useRef, useState, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { fieldErrors, formMessage } from '../api/client';
import { useCreateLeague } from '../api/leagues';
import { TextField } from './AuthForm';
import { BUTTON_PRIMARY } from './controls';
import { Modal } from './Modal';

const FIELDS = ['name', 'teamName'];

/**
 * Crea una lega, in una finestra sopra la home. Riuscita, porta alla lega nuova.
 * L'iniziale non si chiede: la sceglie il server (vedi {@code LeagueService.initialOr}).
 */
export function CreateLeagueDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nameRef = useRef<HTMLInputElement>(null);
  return (
    <Modal open={open} titleId="create-league-title" title="Crea una lega" onClose={onClose} initialFocusRef={nameRef}>
      <CreateLeagueForm nameRef={nameRef} onCreated={onClose} />
    </Modal>
  );
}

/**
 * Il modulo vive dentro la finestra: chiusa, la finestra non c'e' e il modulo con
 * lei, e riaprendola si ricomincia da campi vuoti e senza l'errore di prima.
 *
 * <p>Alto quanto il suo stato piu' alto (min-h-[22rem]): un errore sotto i campi
 * occupa lo spazio che c'era gia', il bottone resta in fondo e la finestra non
 * cresce.
 */
function CreateLeagueForm({ nameRef, onCreated }: {
  nameRef: RefObject<HTMLInputElement | null>;
  onCreated: () => void;
}) {
  const create = useCreateLeague();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [teamName, setTeamName] = useState('');
  const errors = fieldErrors(create.error);
  const message = formMessage(create.error, FIELDS, 'Non sono riuscito a creare la lega. Riprova fra poco.');

  return (
    <form
      className="flex min-h-[22rem] flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate({ name, teamName }, {
          onSuccess: (league) => { onCreated(); navigate(`/leghe/${league.id}`); },
        });
      }}
    >
      <p className="mb-5 text-sm text-muted-foreground">
        Ne diventi l&apos;amministratore: inviti gli altri con un link e prepari le aste.
      </p>
      <TextField ref={nameRef} id="league-name" label="Nome della lega" value={name} onChange={setName}
        errors={errors.name} />
      <TextField id="league-team" label="La tua squadra" value={teamName} onChange={setTeamName}
        errors={errors.teamName} />
      {message ? <p role="alert" className="mt-4 text-sm font-medium text-destructive">{message}</p> : null}
      <div className="mt-auto pt-6">
        <button type="submit" disabled={create.isPending} className={`w-full ${BUTTON_PRIMARY}`}>
          {create.isPending ? 'Creo…' : 'Crea la lega'}
        </button>
      </div>
    </form>
  );
}
