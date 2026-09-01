package com.fantaagent.domain.player;

@FunctionalInterface
public interface RoleLookup {

    /** @throws IllegalArgumentException se il giocatore è sconosciuto */
    Role roleOf(String playerId);
}
