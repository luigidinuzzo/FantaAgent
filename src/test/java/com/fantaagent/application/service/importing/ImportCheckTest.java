package com.fantaagent.application.service.importing;

import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ImportCheckTest {

    private static final Instant AT = Instant.parse("2025-08-30T20:00:00Z");
    private static final UUID ANNA = UUID.randomUUID();
    private static final UUID BRUNO = UUID.randomUUID();
    private static final Map<String, UUID> MAPPING = Map.of("me", ANNA, "p2", BRUNO);

    private static final List<AuctionEvent> ORIGINAL = List.of(
            new AuctionEvent.AuctionStarted(1, AT, "Asta"),
            new AuctionEvent.PlayerPurchased(2, AT, "x", "me", 10),
            new AuctionEvent.PlayerPurchased(3, AT, "y", "p2", 20),
            new AuctionEvent.PurchaseCorrected(4, AT, 2, "p2", 12),
            new AuctionEvent.PhaseAdvanced(5, AT, Role.D));

    @Test
    void unRegistroRiscrittoBenePassa() {
        List<AuctionEvent> imported = List.of(
                new AuctionEvent.AuctionStarted(1, AT, "Asta"),
                new AuctionEvent.PlayerPurchased(2, AT, "x", ANNA.toString(), 10),
                new AuctionEvent.PlayerPurchased(3, AT, "y", BRUNO.toString(), 20),
                new AuctionEvent.PurchaseCorrected(4, AT, 2, BRUNO.toString(), 12),
                new AuctionEvent.PhaseAdvanced(5, AT, Role.D));
        assertThatCode(() -> ImportCheck.verify(ORIGINAL, imported, MAPPING)).doesNotThrowAnyException();
    }

    @Test
    void unaCorrezioneNonRiscrittaSiVede() {
        List<AuctionEvent> imported = List.of(
                new AuctionEvent.AuctionStarted(1, AT, "Asta"),
                new AuctionEvent.PlayerPurchased(2, AT, "x", ANNA.toString(), 10),
                new AuctionEvent.PlayerPurchased(3, AT, "y", BRUNO.toString(), 20),
                new AuctionEvent.PurchaseCorrected(4, AT, 2, "p2", 12),
                new AuctionEvent.PhaseAdvanced(5, AT, Role.D));
        assertThatThrownBy(() -> ImportCheck.verify(ORIGINAL, imported, MAPPING))
                .isInstanceOf(ImportMismatchException.class);
    }

    @Test
    void unEventoMancanteSiVede() {
        assertThatThrownBy(() -> ImportCheck.verify(ORIGINAL, ORIGINAL.subList(0, 4), MAPPING))
                .isInstanceOf(ImportMismatchException.class);
    }
}
