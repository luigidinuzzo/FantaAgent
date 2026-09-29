package com.fantaagent.application.service.importing;

public class ImportMismatchException extends RuntimeException {

    public ImportMismatchException(String what) {
        super("Le rose ricostruite non coincidono con quelle dell'asta originale: l'importazione è stata annullata."
                + " (" + what + ")");
    }
}
