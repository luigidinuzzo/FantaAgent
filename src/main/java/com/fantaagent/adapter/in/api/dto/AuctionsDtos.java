package com.fantaagent.adapter.in.api.dto;

import com.fantaagent.application.service.AuctionRuntime;
import com.fantaagent.domain.player.Role;

import java.time.Instant;

public final class AuctionsDtos {

    private AuctionsDtos() {
    }

    /**
     * Una riga della home: quanto basta a riconoscere un'asta fra le altre.
     *
     * <p>{@code label} e' il nome scelto, oppure l'identificativo per i registri
     * scritti prima che il nome esistesse. La scelta e' gia' del dominio
     * ({@link AuctionRuntime.AuctionSummary#label()}) e non va rifatta qui: due
     * regole per lo stesso ripiego finirebbero per divergere.
     *
     * <p>{@code lastWritten} viaggia come istante ISO e non come data formattata: il
     * formato appartiene a chi mostra, e il client sa gia' in che lingua sta.
     */
    public record AuctionCard(String id, String label, Instant lastWritten,
                              int purchases, Role phase, boolean selected,
                              int teams, int budget, int totalSlots,
                              String myName, Integer myBudgetRemaining) {

        public static AuctionCard from(AuctionRuntime.AuctionSummary s) {
            return new AuctionCard(s.id(), s.label(), s.lastWritten(),
                    s.purchases(), s.phase(), s.selected(),
                    s.teams(), s.budget(), s.totalSlots(), s.myName(), s.myBudgetRemaining());
        }
    }

    /** Il nuovo nome di un'asta. */
    public record RenameRequest(String name) {
    }

    /** L'asta appena creata copiando un'altra. */
    public record DuplicateResponse(String id) {
    }
}
