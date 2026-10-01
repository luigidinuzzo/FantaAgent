import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { PageFrame } from '../domain/PageFrame';
import { PageHeader } from '../domain/PageHeader';
import { FolderPicker } from '../domain/FolderPicker';
import { BUTTON_PRIMARY, FIELD } from '../domain/controls';
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
  const [folder, setFolder] = useState<string | null>(null);

  const members = league.data?.members ?? [];
  const participants = preview.data?.participants ?? [];
  const chosen = participants.map((p) => mapping[p.id] ?? '');
  const complete = participants.length > 0 && chosen.every((c) => c !== '')
    && new Set(chosen).size === chosen.length;
  const errors = fieldErrors(doImport.error ?? preview.error);
  const failure = doImport.isError || preview.isError
    ? [...(errors.files ?? []), ...(errors.mapping ?? [])].join(' ')
      || userMessage(doImport.error ?? preview.error, 'L\'importazione non è riuscita. Riprova.')
    : null;
  // Un alert solo: quello della cartella sotto la cartella, quello dell'importazione
  // accanto al bottone che l'ha tentata.
  const folderAlert = noAuction ? 'In questa cartella non c\'è un\'asta di FantaAgent.'
    : doImport.isError ? null : failure;
  const importAlert = !noAuction && doImport.isError ? failure : null;

  function choose(list: FileList) {
    const picked = Array.from(list);
    setFolder(picked[0]?.webkitRelativePath?.split('/')[0] || 'Cartella scelta');
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

  const trail = [
    { label: 'Le mie leghe', to: '/' },
    { label: league.data?.name ?? 'Lega', to: `/leghe/${leagueId}` },
    { label: "Importa un'asta" },
  ];

  const ready = Boolean(preview.data);

  return (
    <AppShell chrome="top" trail={trail}>
      <PageFrame>
        <div className="mx-auto w-full max-w-3xl">
          <PageHeader title="Importa un'asta" context="Porta qui un'asta giocata con FantaAgent sul computer." />
          {/* Il riquadro ha sempre la stessa altezza: prima della scelta la occupa la
              zona della cartella, dopo la occupano gli abbinamenti. */}
          <section data-testid="import-box" className="panel flex min-h-[57rem] flex-col p-5 md:min-h-[55rem] md:p-6">
            <ol aria-label="Passaggi" className="flex flex-1 flex-col gap-8">
              <li className={ready ? '' : 'flex flex-1 flex-col'}>
                <Step n={1} title="Scegli la cartella" />
                {/* Un solo FolderPicker nei due stati, cambia solo chi lo contiene: chi
                    sceglie un'altra cartella non perde il fuoco sul bottone. */}
                <div className={ready ? 'mt-3'
                  : 'mt-4 flex flex-1 flex-col items-center justify-center gap-5 rounded-lg border-2 border-dashed border-control-border p-6 text-center'}>
                  {ready ? null : (
                    <>
                      <p className="max-w-md text-sm">
                        Serve la cartella di un'asta giocata con FantaAgent sul tuo computer. Dentro ci sono:
                      </p>
                      <div className="space-y-1 text-sm font-medium">
                        <p>le mosse dell'asta</p>
                        <p>l'elenco dei partecipanti</p>
                      </div>
                    </>
                  )}
                  <FolderPicker id="import-folder" picked={folder} onPick={choose} disabled={preview.isPending} />
                  {preview.isPending ? (
                    <p role="status" className="text-sm text-muted-foreground">Leggo l'asta…</p>
                  ) : null}
                </div>
                {folderAlert ? <p role="alert" className="mt-4 text-sm font-medium text-destructive">{folderAlert}</p> : null}
                {preview.data ? (
                  <p className="mt-4 text-sm">
                    <span className="font-medium">{preview.data.name}</span>
                    <span className="text-muted-foreground"> · {preview.data.purchases} acquisti</span>
                  </p>
                ) : null}
              </li>
              <li data-testid="import-step-2" aria-disabled={!ready} className={ready ? '' : 'text-muted-foreground'}>
                <Step n={2} title="Abbina i partecipanti" />
                {ready ? (
                  <>
                    {/* Sul telefono il riquadro perde margini e bordi di lato: la tendina
                        mostra la scelta su una riga, e «squadra · nome» deve starci. */}
                    <div className="mt-3 h-[29rem] overflow-y-auto rounded-lg border border-line p-4 max-sm:rounded-none max-sm:border-x-0 max-sm:px-0">
                      <ul aria-label="Abbinamenti" className="grid gap-x-4 gap-y-3 md:grid-cols-2">
                        {participants.map((p) => (
                          <li key={p.id}>
                            <span className="mb-1 block text-sm">{p.name} <span className="text-muted-foreground">· {p.initial}</span></span>
                            <select aria-label={`Membro per ${p.name}`} value={mapping[p.id] ?? ''}
                              onChange={(e) => setMapping({ ...mapping, [p.id]: e.target.value })}
                              className={`${FIELD} min-h-11 max-sm:px-3 max-sm:-outline-offset-2`}>
                              <option value="">Scegli…</option>
                              {members.map((m) => (
                                <option key={m.userId} value={m.userId}>{m.teamName} · {m.displayName}</option>
                              ))}
                            </select>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Ogni partecipante va a un membro diverso. Chi non è ancora nella lega va invitato prima.
                    </p>
                    <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <button type="button" disabled={!complete || doImport.isPending}
                        onClick={() => doImport.mutate({ files, mapping },
                          { onSuccess: (r) => navigate(`/leghe/${leagueId}/aste/${r.auctionId}`) })}
                        className={`${BUTTON_PRIMARY} shrink-0 px-5`}>
                        {doImport.isPending ? 'Importo…' : 'Importa l\'asta'}
                      </button>
                      {importAlert ? (
                        <p role="alert" className="min-w-0 flex-1 basis-60 text-sm font-medium text-destructive">{importAlert}</p>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-sm">Dopo aver scelto la cartella, ogni partecipante dell'asta va a un membro della lega.</p>
                )}
              </li>
            </ol>
          </section>
        </div>
      </PageFrame>
    </AppShell>
  );
}

function Step({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="flex items-center gap-3 text-lg font-semibold">
      <span aria-hidden="true"
        className="grid size-8 shrink-0 place-items-center rounded-lg border border-control-border text-sm font-semibold">{n}</span>
      {title}
    </h2>
  );
}
