package com.fantaagent.application.port.out;

import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.player.RoleLookup;
import com.fantaagent.domain.player.SeasonStats;

import java.util.List;
import java.util.Optional;

public interface PlayerCatalog extends RoleLookup {

    Optional<Player> byId(String playerId);

    List<Player> all();

    List<Player> byRole(Role role);

    List<SeasonStats> statsOf(String playerId);
}
