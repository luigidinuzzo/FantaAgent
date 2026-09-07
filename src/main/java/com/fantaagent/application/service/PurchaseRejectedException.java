package com.fantaagent.application.service;

/**
 * Un acquisto rifiutato, col motivo in forma tipizzata.
 *
 * <p><b>Estende {@link IllegalArgumentException} di proposito.</b> I controller
 * HTML esistenti catturano quella, e sostituirla imporrebbe di modificarli tutti
 * insieme al resto — cioe' di toccare la rete di sicurezza proprio mentre serve.
 * Estendendola, il comportamento vecchio resta identico e l'API guadagna il
 * motivo di cui ha bisogno per emettere un {@code type} stabile.
 */
public class PurchaseRejectedException extends IllegalArgumentException {

    public enum Reason {
        ALREADY_SOLD,
        INSUFFICIENT_BUDGET,
        ROLE_SLOTS_EXHAUSTED
    }

    private final transient Reason reason;

    public PurchaseRejectedException(Reason reason, String message) {
        super(message);
        this.reason = reason;
    }

    public Reason reason() {
        return reason;
    }
}
