import type { ReactNode } from 'react';

/**
 * L'intestazione di ogni pagina di gestione: titolo, una riga di contesto, al
 * massimo due azioni normali. L'oro della pagina sta nel contenuto, mai qui.
 */
export function PageHeader({ title, context, leading, actions, titleId }: {
  title: string;
  context?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  titleId?: string;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-center gap-4">
      {leading}
      <div className="min-w-0 flex-1">
        <h1 id={titleId} className="w-exp text-2xl font-bold md:text-3xl">{title}</h1>
        {context ? <p className="mt-1 text-sm text-muted-foreground">{context}</p> : null}
      </div>
      {actions ? (
        <div role="group" aria-label="Azioni della pagina"
          className="flex gap-3 max-sm:w-full max-sm:[&>*]:flex-1">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
