import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { fieldErrors, userMessage } from '../api/client';
import { IMPORT_FILES, useImportAuction, useImportPreview, useLeague } from '../api/leagues';
import type { MemberView } from '../api/types';

/** Il membro che porta lo stesso nome, se ce n'e' uno solo: un suggerimento, non una scelta. */
function guess(name: string, members: MemberView[]): string {
  const n = name.trim().toLowerCase();
  const hits = members.filter((m) =>
    m.displayName.trim().toLowerCase() === n || m.teamName.trim().toLowerCase() === n);
  return hits.length === 1 ? hits[0].userId : '';
}

export function ImportRoute() {
  const { leagueId = '' } = useParams();
  const league = useLeague(leagueId);
  const preview = useImportPreview(leagueId);
  const doImport = useImportAuction(leagueId);
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [noAuction, setNoAuction] = useState(false);

  const members = league.data?.members ?? [];
  const participants = preview.data?.participants ?? [];
  const chosen = participants.map((p) => mapping[p.id] ?? '');
  const complete = participants.length > 0 && chosen.every((c) => c !== '')
    && new Set(chosen).size === chosen.length;
  const errors = fieldErrors(doImport.error ?? preview.error);
  const alert = noAuction
    ? 'In questa cartella non c\'è un\'asta di FantaAgent.'
    : doImport.isError || preview.isError
      ? [...(errors.files ?? []), ...(errors.mapping ?? [])].join(' ')
        || userMessage(doImport.error ?? preview.error, 'L\'importazione non è riuscita. Riprova.')
      : null;

  function choose(list: FileList | null) {
    const picked = Array.from(list ?? []);
    if (!picked.some((f) => f.name === 'events.jsonl')) {
      // Una cartella diversa scelta dopo un'anteprima valida: si riparte da zero,
      // altrimenti restano in giro l'anteprima e gli abbinamenti di prima, col
      // pulsante ancora acceso pronto a importare i file sbagliati.
      setNoAuction(true);
      preview.reset();
      doImport.reset();
      setFiles([]);
      setMapping({});
      return;
    }
    setNoAuction(false);
    doImport.reset();
    setFiles(picked.filter((f) => IMPORT_FILES.includes(f.name)));
    preview.mutate(picked, {
      onSuccess: (p) => setMapping(Object.fromEntries(p.participants.map((x) => [x.id, guess(x.name, members)]))),
    });
  }

  return (
    <AppShell chrome="top">
      {/* Come ProfileRoute: senza centrare, un modulo corto come questo lascia un
          vuoto enorme sotto sulle finestre larghe. min-h copre l'altezza reale
          sotto la barra (100dvh meno --header-h meno il padding verticale di
          <main>, p-4/md:p-6). */}
      <div className="flex min-h-[calc(100dvh-var(--header-h)-2rem)] items-center justify-center md:min-h-[calc(100dvh-var(--header-h)-3rem)]">
        <div className="mx-auto w-full max-w-3xl">
          <p className="text-sm"><Link to={`/leghe/${leagueId}`} className="underline underline-offset-4">Torna alla lega</Link></p>
          <h1 className="w-exp mt-2 text-2xl font-semibold">Importa un'asta</h1>
          <section className="panel mt-4 rounded-2xl p-6">
            <p className="text-sm">
              Scegli la cartella di un'asta giocata con la versione di FantaAgent installata sul tuo computer.
              Poi abbina ogni partecipante a un membro della lega.
            </p>
            <label htmlFor="import-folder" className="mt-4 block text-sm font-medium">Scegli la cartella dell'asta</label>
            <input id="import-folder" type="file" multiple
              {...{ webkitdirectory: '', directory: '' }}
              onChange={(e) => choose(e.target.files)}
              className="mt-2 block min-h-11 text-sm" />
            {alert ? <p role="alert" className="mt-4 text-sm font-medium text-destructive">{alert}</p> : null}
          </section>
          {preview.isPending ? (
            <p role="status" className="mt-4 text-sm text-muted-foreground">Leggo l'asta…</p>
          ) : null}
          {preview.data ? (
            <section className="panel mt-4 rounded-2xl p-6">
              <h2 className="w-exp text-lg font-semibold">{preview.data.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{preview.data.purchases} acquisti</p>
              <table aria-label="Abbinamenti" className="mt-4 w-full text-sm">
                <thead>
                  <tr><th className="py-2 text-left">Nell'asta</th><th className="py-2 text-left">Membro della lega</th></tr>
                </thead>
                <tbody>
                  {participants.map((p) => (
                    <tr key={p.id} className="border-t border-line">
                      <td className="py-2">{p.name} <span className="text-muted-foreground">· {p.initial}</span></td>
                      <td className="py-2">
                        <select aria-label={`Membro per ${p.name}`} value={mapping[p.id] ?? ''}
                          onChange={(e) => setMapping({ ...mapping, [p.id]: e.target.value })}
                          className="min-h-11 w-full rounded-xl border border-line-strong bg-surface px-3">
                          <option value="">Scegli…</option>
                          {members.map((m) => (
                            <option key={m.userId} value={m.userId}>{m.teamName} · {m.displayName}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!complete ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Ogni partecipante va a un membro diverso. Chi non è ancora nella lega va invitato prima.
                </p>
              ) : null}
              <button type="button" disabled={!complete || doImport.isPending}
                onClick={() => doImport.mutate({ files, mapping },
                  { onSuccess: (r) => navigate(`/leghe/${leagueId}/aste/${r.auctionId}`) })}
                className="mt-6 min-h-11 rounded-full bg-accent px-5 font-semibold text-on-accent disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground">
                {doImport.isPending ? 'Importo…' : 'Importa l\'asta'}
              </button>
            </section>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
