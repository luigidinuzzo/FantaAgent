package com.fantaagent.adapter.out.file.event;

import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.player.Role;

import java.time.Instant;

/**
 * Forma serializzata degli eventi. Record piatto con discriminante esplicito: evita la
 * configurazione polimorfica di Jackson e tiene la libreria fuori dal dominio.
 */
public record EventDto(
        String type,
        long seq,
        Instant at,
        Role role,
        String playerId,
        String participantId,
        Integer price,
        Long targetSeq,
        String name) {

    public static EventDto from(AuctionEvent event) {
        return switch (event) {
            case AuctionEvent.AuctionStarted e ->
                    new EventDto("AuctionStarted", e.seq(), e.at(), null, null, null, null, null,
                            e.name());
            case AuctionEvent.PhaseAdvanced e ->
                    new EventDto("PhaseAdvanced", e.seq(), e.at(), e.role(), null, null, null, null, null);
            case AuctionEvent.PlayerPurchased e ->
                    new EventDto("PlayerPurchased", e.seq(), e.at(), null,
                            e.playerId(), e.participantId(), e.price(), null, null);
            case AuctionEvent.PurchaseRevoked e ->
                    new EventDto("PurchaseRevoked", e.seq(), e.at(), null,
                            null, null, null, e.targetSeq(), null);
            case AuctionEvent.PurchaseCorrected e ->
                    new EventDto("PurchaseCorrected", e.seq(), e.at(), null,
                            null, e.newParticipantId(), e.newPrice(), e.targetSeq(), null);
        };
    }

    public AuctionEvent toDomain() {
        return switch (type) {
            // name assente nei registri scritti prima che il nome esistesse: resta null,
            // e chi lo mostra ricade sull'identificativo dell'asta.
            case "AuctionStarted" -> new AuctionEvent.AuctionStarted(seq, at, name);
            case "PhaseAdvanced" -> new AuctionEvent.PhaseAdvanced(seq, at, role);
            case "PlayerPurchased" ->
                    new AuctionEvent.PlayerPurchased(seq, at, playerId, participantId, price);
            case "PurchaseRevoked" -> new AuctionEvent.PurchaseRevoked(seq, at, targetSeq);
            case "PurchaseCorrected" ->
                    new AuctionEvent.PurchaseCorrected(seq, at, targetSeq, participantId, price);
            default -> throw new IllegalStateException("tipo di evento sconosciuto: " + type);
        };
    }
}
