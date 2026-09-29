package com.fantaagent.application.port.out;

import java.util.Map;

public interface ImportedAuctionReader {

    /**
     * @param files nome del file (senza cartella) → contenuto
     * @throws com.fantaagent.application.service.importing.InvalidImportException se manca
     *         il registro o un file non si legge
     */
    ImportedAuction read(Map<String, byte[]> files);
}
