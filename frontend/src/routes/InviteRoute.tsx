import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMe } from '../api/auth';
import { fieldErrors, userMessage } from '../api/client';
import { useAcceptInvite, useInvitePreview } from '../api/leagues';
import { AuthLayout, PRIMARY_BUTTON, TEXT_LINK, TextField } from '../domain/AuthForm';

/**
 * Pubblica: chi apre il link del gruppo di solito non ha ancora un account. Si vede
 * la lega e chi invita; per entrare si passa da registrazione o accesso, e si torna
 * qui con {@code ?dopo}.
 */
export function InviteRoute() {
  const { token = '' } = useParams();
  const preview = useInvitePreview(token);
  const me = useMe();
  const accept = useAcceptInvite(token);
  const navigate = useNavigate();
  const [teamName, setTeamName] = useState('');
  const back = encodeURIComponent(`/invito/${token}`);
  const errors = fieldErrors(accept.error);

  if (preview.isError) {
    return (
      <AuthLayout title="Invito">
        <p role="alert" className="text-sm font-medium text-destructive">
          {userMessage(preview.error, 'Non riesco ad aprire questo invito. Riprova fra poco.')}
        </p>
      </AuthLayout>
    );
  }
  if (!preview.data || me.isPending) return <AuthLayout title="Invito"><p className="text-sm">Un attimo…</p></AuthLayout>;
  const p = preview.data;

  return (
    <AuthLayout title={p.leagueName}>
      <p className="text-sm">{p.invitedBy} ti invita in <strong>{p.leagueName}</strong>.</p>
      {!me.data ? (
        <div className="mt-6 grid gap-3">
          <Link to={`/registrati?dopo=${back}`} className={`${PRIMARY_BUTTON} mt-0 flex items-center justify-center`}>
            Registrati
          </Link>
          <p className="text-sm">Hai già un account? <Link to={`/accedi?dopo=${back}`} className={TEXT_LINK}>Accedi</Link></p>
        </div>
      ) : p.alreadyMember ? (
        <p className="mt-6 text-sm">
          Fai già parte di questa lega. <Link to={`/leghe/${p.leagueId}`} className={TEXT_LINK}>Vai alla lega</Link>
        </p>
      ) : (
        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault();
            accept.mutate({ teamName }, { onSuccess: (league) => navigate(`/leghe/${league.id}`) });
          }}
        >
          <TextField id="invite-team" label="La tua squadra" value={teamName} onChange={setTeamName}
            errors={errors.teamName} />
          {accept.isError && Object.keys(errors).length === 0 ? (
            <p role="alert" className="mt-4 text-sm font-medium text-destructive">
              {userMessage(accept.error, 'Non sono riuscito a farti entrare. Riprova fra poco.')}
            </p>
          ) : null}
          <button type="submit" className={PRIMARY_BUTTON} disabled={accept.isPending}>
            {accept.isPending ? 'Entro…' : 'Entra nella lega'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
