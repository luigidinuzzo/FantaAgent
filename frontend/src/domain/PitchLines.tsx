/**
 * Quanto le linee possono farsi vedere, per contesto.
 *
 * <p>Il test di contrasto del progetto misura COPPIE DI TOKEN — un testo sopra un
 * fondo — e non sa niente di una texture disegnata in mezzo ai due. Quel limite non
 * puo' quindi essere verificato li: vive qui, con il suo perche', ed e' fissato da
 * PitchLines.test.tsx. 4% su un fondo verde scurissimo resta dentro il rumore di
 * quantizzazione dello schermo; il testo che ci passa sopra non se ne accorge.
 */
export const APP_OPACITY = 0.04;

/**
 * Sulla proiezione il vincolo cade: lo schermo e' grande, il testo e' enorme, e
 * quella schermata esiste per essere guardata da lontano. Le linee possono
 * finalmente leggersi come linee di un campo invece che come una sfumatura.
 */
export const PROJECTION_OPACITY = 0.1;

/**
 * Le linee del campo: mezzeria, cerchio di centrocampo, due aree di rigore.
 *
 * <p>Non e' una texture applicata sopra il progetto: e' la continuazione del
 * linguaggio che {@code PlayerDecisionCard} aveva gia' cominciato con l'arco
 * d'angolo commentato «una linea di campo, non un ornamento».
 *
 * <p>SVG inline e non un'immagine: il tratto e' {@code --line}, cioe' lo stesso
 * token dei bordi di tutta l'applicazione. Un PNG sarebbe un colore in piu' fuori
 * dalla palette, invisibile al test di contrasto e alla prossima ritinteggiatura.
 */
export function PitchLines({ variant }: { variant: 'app' | 'projection' }) {
  const opacity = variant === 'app' ? APP_OPACITY : PROJECTION_OPACITY;
  return (
    // z-0, non -z-10: il componente viene montato dentro una radice che porta
    // bg-background e non crea un proprio contesto di impilamento, quindi un
    // indice negativo finirebbe dietro il fondo opaco di quella radice e le
    // linee non si vedrebbero mai. Il prossimo task dara' z-10 a header e main,
    // cosi' il contenuto resta sopra a questo sfondo.
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <svg
        aria-hidden="true"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        style={{ opacity }}
      >
        <g fill="none" stroke="var(--line-strong)" strokeWidth="2">
          <rect x="20" y="20" width="1160" height="760" />
          <line x1="600" y1="20" x2="600" y2="780" />
          <circle cx="600" cy="400" r="110" />
          <circle cx="600" cy="400" r="4" fill="var(--line-strong)" />
          <rect x="20" y="220" width="180" height="360" />
          <rect x="1000" y="220" width="180" height="360" />
          <rect x="20" y="320" width="70" height="160" />
          <rect x="1110" y="320" width="70" height="160" />
        </g>
      </svg>
    </div>
  );
}
