/**
 * L'erba a strisce della meta' campo delle pagine d'ingresso: strisce di taglio, e
 * nient'altro. Prima copriva tutta la finestra dietro ogni schermata; ora il fondo
 * dell'app e' uniforme e l'erba resta qui, come firma del prodotto.
 *
 * <p>Riempie l'antenato posizionato piu' vicino ({@code absolute}), non la
 * finestra: chi la monta decide dove sta.
 *
 * <p><b>Nessun testo poggia sull'erba.</b> Tutto cio' che si legge sta in un
 * pannello pieno ({@code bg-surface}) con il suo bordo.
 *
 * <p>Le strisce vivono in {@code .pitch-grass} (index.css): due token della
 * palette in un gradiente ripetuto, dodici strisce da un lato all'altro, di
 * traverso — verticali sugli schermi orizzontali, orizzontali su quelli
 * verticali.
 */
export function PitchGrass({ className = 'inset-0' }: { className?: string }) {
  return (
    // pointer-events-none: sta sotto tutto e non deve rubare un clic ai
    // controlli. aria-hidden: e' decorazione, non contenuto.
    <div
      data-testid="pitch"
      aria-hidden="true"
      className={`pitch-grass pointer-events-none absolute z-0 ${className}`}
    />
  );
}
