/**
 * L'erba dietro ogni schermata: strisce di taglio, e nient'altro.
 *
 * <p><b>Le linee in gesso sono spente.</b> Prima qui c'era un campo intero
 * disegnato in SVG — cerchio di centrocampo, aree, dischetti, archi d'angolo —
 * che riempiva lo spazio sotto la barra. Ma i pannelli pieni ci stanno sopra e ne
 * coprono la maggior parte: quel che si vedeva erano frammenti di disegno negli
 * spazi fra un pannello e l'altro, e il cerchio di centrocampo che affiorava
 * sotto il banco si leggeva come un difetto di resa, non come un'identita'. Le
 * strisce restano perche' sono uno sfondo e si comportano da sfondo: non hanno
 * pezzi da tagliare.
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
      className={`pitch-grass pointer-events-none fixed z-0 ${className}`}
    />
  );
}
