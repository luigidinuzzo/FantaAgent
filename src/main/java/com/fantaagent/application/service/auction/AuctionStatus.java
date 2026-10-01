package com.fantaagent.application.service.auction;

/**
 * A che punto e' un'asta, dai suoi numeri. Conclusa con la stessa regola della
 * schermata dell'asta: tutti i posti di tutte le squadre pieni.
 */
public enum AuctionStatus {
    NOT_STARTED, IN_PROGRESS, CONCLUDED;

    public static AuctionStatus of(int purchases, int totalSlots) {
        if (purchases == 0) return NOT_STARTED;
        return purchases >= totalSlots ? CONCLUDED : IN_PROGRESS;
    }
}
