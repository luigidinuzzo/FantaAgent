package com.fantaagent.application.service.league;

import java.util.List;
import java.util.Map;

public class InvalidLeagueDataException extends RuntimeException {

    private final Map<String, List<String>> errors;

    public InvalidLeagueDataException(Map<String, List<String>> errors) {
        super("dati della lega non validi: " + errors.keySet());
        this.errors = Map.copyOf(errors);
    }

    public Map<String, List<String>> errors() {
        return errors;
    }
}
