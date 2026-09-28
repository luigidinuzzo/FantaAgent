import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { useLogout, useMe, useRenameMe, useResendVerification } from '../api/auth';
import { fieldErrors, userMessage } from '../api/client';
import { PRIMARY_BUTTON, TextField } from '../domain/AuthForm';

export function ProfileRoute() {
  const me = useMe();
  const rename = useRenameMe();
  const resend = useResendVerification();
  const logout = useLogout();
  const navigate = useNavigate();
  const [name, setName] = useState<string | null>(null);
  if (!me.data) return null;
  const current = name ?? me.data.displayName;
  const errors = fieldErrors(rename.error);

  return (
    <AppShell chrome="top">
      <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
        <section aria-labelledby="profile-name" className="panel rounded-2xl p-6">
          <h1 id="profile-name" className="w-exp text-lg font-semibold">Il tuo profilo</h1>
          <form className="mt-4" onSubmit={(e) => { e.preventDefault(); rename.mutate(current); }}>
            <TextField id="profile-display-name" label="Il tuo nome" autoComplete="name"
              value={current} onChange={setName} errors={errors.displayName} />
            <button type="submit" disabled={rename.isPending || current === me.data.displayName}
              className={PRIMARY_BUTTON}>
              {rename.isPending ? 'Salvo…' : 'Salva il nome'}
            </button>
          </form>
        </section>
        <section aria-labelledby="profile-access" className="panel rounded-2xl p-6">
          <h2 id="profile-access" className="w-exp text-lg font-semibold">Accesso</h2>
          <p className="mt-4 text-sm">{me.data.email}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {me.data.emailVerified ? 'Indirizzo confermato.' : 'Indirizzo non ancora confermato.'}
          </p>
          {!me.data.emailVerified ? (
            <button type="button" disabled={resend.isPending || resend.isSuccess}
              onClick={() => resend.mutate()}
              className="mt-4 min-h-11 rounded-full border border-line-strong px-5 font-medium disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
              {resend.isSuccess ? 'Email inviata' : 'Mandami di nuovo la conferma'}
            </button>
          ) : null}
          <button type="button" disabled={logout.isPending}
            onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/accedi', { replace: true }) })}
            className="mt-6 flex min-h-11 w-full items-center justify-center rounded-full border border-line-strong px-5 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
            Esci
          </button>
          {rename.isError && !errors.displayName ? (
            <p role="alert" className="mt-4 text-sm font-medium text-destructive">
              {userMessage(rename.error, 'Non sono riuscito a salvare. Riprova fra poco.')}
            </p>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
