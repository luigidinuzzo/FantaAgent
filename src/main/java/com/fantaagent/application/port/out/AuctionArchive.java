package com.fantaagent.application.port.out;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Le aste presenti sull'archivio, ciascuna col proprio log.
 *
 * <p>Questa porta apre file, non li riscrive: {@link #open} deve restituire uno store
 * posizionato sul log dell'asta chiesta senza troncarlo, rinominarlo o cancellarlo, e
 * non deve avere alcun modo di distruggere un log esistente. È l'unica garanzia che
 * "cambiare asta" non possa mai perdere un registro già scritto.
 */
public interface AuctionArchive {

    /** Identificatori delle aste trovate, in ordine stabile. */
    List<String> auctionIds();

    boolean exists(String auctionId);

    /**
     * Apre il log dell'asta indicata. Non crea nulla e non tocca il contenuto: il file
     * nasce, se non esiste, solo al primo append.
     */
    AuctionEventStore open(String auctionId);

    /** Ultima scrittura del log, se l'asta esiste. */
    Optional<Instant> lastWritten(String auctionId);
}
