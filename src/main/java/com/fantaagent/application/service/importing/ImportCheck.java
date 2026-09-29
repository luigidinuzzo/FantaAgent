package com.fantaagent.application.service.importing;

import com.fantaagent.application.service.auction.LogSummary;
import com.fantaagent.domain.auction.AuctionEvent;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Il registro importato dice le stesse cose dell'originale, con i membri al posto dei
 * nomi? Senza catalogo e senza proiezione, apposta: vedi {@link AuctionImportService}.
 */
public final class ImportCheck {

    private ImportCheck() {
    }

    public static void verify(List<AuctionEvent> original, List<AuctionEvent> imported, Map<String, UUID> mapping) {
        if (original.size() != imported.size()) {
            throw new ImportMismatchException("eventi: " + original.size() + " contro " + imported.size());
        }
        if (!Objects.equals(LogSummary.phase(original, null), LogSummary.phase(imported, null))) {
            throw new ImportMismatchException("fase");
        }
        for (Map.Entry<String, UUID> e : mapping.entrySet()) {
            String member = e.getValue().toString();
            if (LogSummary.spentBy(original, e.getKey()) != LogSummary.spentBy(imported, member)) {
                throw new ImportMismatchException("crediti di " + e.getKey());
            }
            if (!LogSummary.playersOf(original, e.getKey()).equals(LogSummary.playersOf(imported, member))) {
                throw new ImportMismatchException("rosa di " + e.getKey());
            }
        }
    }
}
