package com.fantaagent.application.service.importing;

import java.util.List;
import java.util.Map;

public class InvalidImportException extends RuntimeException {

    private final Map<String, List<String>> errors;

    public InvalidImportException(Map<String, List<String>> errors) {
        super("importazione non valida: " + errors.keySet());
        this.errors = Map.copyOf(errors);
    }

    public Map<String, List<String>> errors() {
        return errors;
    }
}
