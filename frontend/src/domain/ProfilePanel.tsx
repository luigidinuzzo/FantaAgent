/**
 * Il profilo dell'utente, finto finche' non c'e' l'accesso.
 *
 * <p>Nessuna chiamata al server e nessun campo modificabile: non esiste ancora un
 * utente da leggere ne' da salvare. Mostrare caselle di testo che non salvano
 * niente farebbe credere il contrario. I valori sono i predefiniti che l'accesso
 * sostituira'; la nota in fondo lo dice a chi guarda.
 */
const DEFAULT_PROFILE = {
  name: 'Allenatore',
  email: 'Non ancora impostata',
  language: 'Italiano',
  theme: 'Campo',
};

const FIELDS: Array<{ key: keyof typeof DEFAULT_PROFILE; label: string }> = [
  { key: 'name', label: 'Nome' },
  { key: 'email', label: 'Email' },
  { key: 'language', label: 'Lingua' },
  { key: 'theme', label: 'Tema' },
];

export function ProfilePanel() {
  return (
    <section aria-labelledby="profile-heading" className="panel max-w-2xl rounded-2xl p-6">
      <h2 id="profile-heading" className="w-exp text-xl font-extrabold">
        Il tuo profilo
      </h2>
      <dl className="mt-4 divide-y divide-line">
        {FIELDS.map((f) => (
          <div key={f.key} className="flex min-h-11 items-center justify-between gap-4 py-2">
            <dt className="text-sm text-muted-foreground">{f.label}</dt>
            <dd className="font-bold">{DEFAULT_PROFILE[f.key]}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm text-muted-foreground">
        Sarà modificabile dopo l'introduzione dell'accesso.
      </p>
    </section>
  );
}
