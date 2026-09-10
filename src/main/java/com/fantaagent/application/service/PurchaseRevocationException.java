package com.fantaagent.application.service;

/**
 * I due modi in cui una revoca puo' essere rifiutata, distinti.
 *
 * <p>Erano un {@code IllegalArgumentException} solo, e il client riceveva un 422 per
 * entrambi: "questo acquisto non esiste" e "questo acquisto e' gia' stato annullato"
 * sono pero' due fatti diversi — il primo dice che il riferimento e' sbagliato, il
 * secondo che l'operazione e' gia' avvenuta — e una schermata che li confonde chiede
 * di riprovare una cosa gia' fatta.
 *
 * <p><b>Estende {@link IllegalArgumentException} deliberatamente.</b> Il controller
 * Thymeleaf la cattura come tale e resta in vita sotto {@code /legacy}: cambiarne la
 * gerarchia la farebbe sfuggire a quel catch e uscire come pagina d'errore invece che
 * come messaggio nella pagina. Stessa scelta gia' fatta per
 * {@link PurchaseRejectedException}.
 */
public class PurchaseRevocationException extends IllegalArgumentException {

    public enum Reason {
        /** Nessun acquisto con quell'identificativo nel registro. */
        NOT_FOUND,
        /** C'e', ma un evento di compensazione lo ha gia' annullato. */
        ALREADY_REVOKED
    }

    private final Reason reason;

    public PurchaseRevocationException(Reason reason, String message) {
        super(message);
        this.reason = reason;
    }

    public Reason reason() {
        return reason;
    }
}
