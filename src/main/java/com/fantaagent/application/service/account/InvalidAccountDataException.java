package com.fantaagent.application.service.account;

import java.util.List;
import java.util.Map;

/** Dati di registrazione non validi, per campo: il modulo mostra ogni frase accanto al suo. */
public class InvalidAccountDataException extends RuntimeException {

    private final Map<String, List<String>> errors;

    public InvalidAccountDataException(Map<String, List<String>> errors) {
        super("dati dell'account non validi: " + errors.keySet());
        this.errors = Map.copyOf(errors);
    }

    public Map<String, List<String>> errors() {
        return errors;
    }
}
