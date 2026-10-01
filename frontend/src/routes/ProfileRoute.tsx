import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { PageFrame } from '../domain/PageFrame';
import { useLogout, useMe, useRenameMe, useResendVerification } from '../api/auth';
import { fieldErrors, userMessage } from '../api/client';
import { TextField } from '../domain/AuthForm';
import { BUTTON_SECONDARY } from '../domain/controls';
import { SaveBar } from '../domain/SaveBar';
import { SettingsLayout, type SettingsSection } from '../domain/SettingsLayout';

const TITLE = 'Il tuo profilo';
const SECTIONS: SettingsSection[] = [
  { id: 'sezione-nome', label: 'Il tuo nome', shortLabel: 'Nome' },
  { id: 'sezione-accesso', label: 'Accesso' },
];

/** Lo spazio sopra una sezione quando ci porta l'indice, come nelle regole della lega. */
const ANCHOR = 'scroll-mt-[calc(var(--header-h)+4rem)]';

function ProfileSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titolo`} className={`panel ${ANCHOR} p-5 md:p-6`}>
      <h2 id={`${id}-titolo`} className="w-exp mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Il profilo: il nome con cui ti vedono gli altri, che si salva dalla barra in
 * fondo, e l'accesso. «Esci» sta in fondo alla pagina, staccato: non e' un
 * salvataggio e non va nella barra.
 */
export function ProfileRoute() {
  const me = useMe();
  const rename = useRenameMe();
  const resend = useResendVerification();
  const logout = useLogout();
  const navigate = useNavigate();
  const [name, setName] = useState<string | null>(null);
  const trail = [{ label: 'Le mie leghe', to: '/' }, { label: TITLE }];

  if (!me.data) {
    // La stessa cornice della schermata pronta: si riempie, non cambia forma.
    return (
      <AppShell chrome="top" trail={trail}>
      <PageFrame>
        <SettingsLayout title={TITLE} context={' '} sections={SECTIONS} ready={false}>
          <ProfileSection id={SECTIONS[0].id} title={SECTIONS[0].label}><div className="min-h-20" /></ProfileSection>
          <ProfileSection id={SECTIONS[1].id} title={SECTIONS[1].label}><div className="min-h-12" /></ProfileSection>
        </SettingsLayout>
      </PageFrame>
      </AppShell>
    );
  }

  const saved = me.data.displayName;
  const current = name ?? saved;
  const dirty = current !== saved;
  const errors = fieldErrors(rename.error);
  // L'errore del campo sta sotto il campo; ogni altro nella barra, unico alert.
  const barError = rename.isError && !errors.displayName
    ? userMessage(rename.error, 'Non sono riuscito a salvare il nome. Riprova fra poco.')
    : null;

  function change(next: string) {
    setName(next);
    rename.reset();
  }

  function reset() {
    setName(null);
    rename.reset();
  }

  function submit() {
    if (!dirty || rename.isPending) return;
    rename.mutate(current, { onSuccess: () => setName(null) });
  }

  return (
    <AppShell chrome="top" trail={trail}>
      <PageFrame>
        <SettingsLayout
          title={TITLE}
          context={me.data.email}
          sections={SECTIONS}
          ready
          saveBar={(
            <SaveBar dirty={dirty} pending={rename.isPending} error={barError} saveLabel="Salva il nome"
              onSave={submit} onReset={reset} />
          )}
          footer={(
            <div data-testid="settings-footer" className="border-t border-line pt-6">
              <button type="button" disabled={logout.isPending} className={BUTTON_SECONDARY}
                onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/accedi', { replace: true }) })}>
                Esci
              </button>
            </div>
          )}
        >
          <ProfileSection id="sezione-nome" title="Il tuo nome">
            {/* Invio salva come il bottone della barra. */}
            <form className="max-w-md" onSubmit={(e) => { e.preventDefault(); submit(); }}>
              <TextField id="profile-display-name" label="Nome" autoComplete="name"
                value={current} onChange={change} errors={errors.displayName} />
            </form>
          </ProfileSection>
          <ProfileSection id="sezione-accesso" title="Accesso">
            <p className="text-base">{me.data.email}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {me.data.emailVerified ? 'Indirizzo confermato.' : 'Indirizzo non ancora confermato.'}
            </p>
            {!me.data.emailVerified ? (
              <button type="button" disabled={resend.isPending || resend.isSuccess}
                onClick={() => resend.mutate()} className={`mt-4 ${BUTTON_SECONDARY}`}>
                {resend.isSuccess ? 'Email inviata' : 'Mandami di nuovo la conferma'}
              </button>
            ) : null}
          </ProfileSection>
        </SettingsLayout>
      </PageFrame>
    </AppShell>
  );
}
