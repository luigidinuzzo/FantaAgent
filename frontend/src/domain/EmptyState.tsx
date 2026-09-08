/**
 * Lo schermo vuoto detto a parole, con il gesto che lo riempie.
 *
 * <p>Esiste come componente e non come paragrafo copiato perche' lo era: la
 * stessa riga, byte per byte, in AuctionRoute e in PlayerTable. La specifica
 * (§5.4) chiede che nessuna route definisca stile proprio, e due copie dello
 * stesso stile divergono alla prima modifica fatta su una sola delle due.
 */
export function EmptyState({ children }: { children: string }) {
  return (
    <p className="border border-dashed border-line p-6 text-sm text-muted-foreground">
      {children}
    </p>
  );
}
