import { AppShell } from '../AppShell';

/**
 * La schermata proiettata sullo schermo condiviso.
 *
 * <p>Non ha azioni, e non e' una semplificazione: una schermata che nessuno tocca non
 * puo' far trapelare niente per sbaglio, e non c'e' il rischio di digitare su quella
 * sbagliata mentre otto persone la guardano. Si conduce dal portatile, dove ci sono i
 * tetti.
 */
export function ProjectionRoute() {
  return (
    <AppShell>
      <h1 className="w-exp text-xl font-extrabold">Proiezione</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        I tabelloni arrivano fra poco.
      </p>
    </AppShell>
  );
}
