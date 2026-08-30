package com.fantaagent.domain.league;

public record Participant(String id, String name, char initial, boolean me) {

    public Participant {
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("participant id must not be blank");
        }
        initial = Character.toUpperCase(initial);
    }
}
