package com.fantaagent.adapter.in.api.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public final class PurchaseDtos {

    private PurchaseDtos() {
    }

    /**
     * @param requestId chiave generata dal client, obbligatoria. Senza rete di
     *                  mezzo un acquisto non poteva partire due volte; con la
     *                  rete, una risposta persa e un secondo clic scrivono due
     *                  eventi che il registro append-only non puo' cancellare —
     *                  puo' solo compensarli dopo, a danno fatto.
     */
    public record PurchaseRequest(@NotBlank String requestId, @NotBlank String playerId,
                                  @NotBlank String participantId, @Min(1) int price) {
    }

    public record PurchaseResponse(long seq, String playerId, String participantId, int price) {
    }
}
