package com.fantaagent.application.service.account;

/**
 * Link sconosciuto, scaduto, gia' usato o di un altro tipo: per chi l'ha aperto la
 * differenza non cambia cosa fare, e dirla aiuterebbe solo chi prova link a caso.
 */
public class InvalidTokenException extends RuntimeException {

    public InvalidTokenException() {
        super("Il link non è valido o è scaduto.");
    }
}
