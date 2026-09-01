package com.fantaagent.domain.player;

public record Player(String id, String name, String team, Role role, int listPrice) {

    public Player {
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("player id must not be blank");
        }
        if (listPrice < 1) {
            throw new IllegalArgumentException("list price must be at least 1 for " + name);
        }
    }
}
