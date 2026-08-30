package com.fantaagent.adapter.out.file;

import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.player.SeasonStats;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

public class InMemoryPlayerCatalog implements PlayerCatalog {

    private final Map<String, Player> byId;
    private final Map<Role, List<Player>> byRole;
    private final Map<String, List<SeasonStats>> statsByPlayer;

    public InMemoryPlayerCatalog(List<Player> players, List<SeasonStats> stats) {
        this.byId = players.stream().collect(Collectors.toMap(
                Player::id, p -> p, (a, b) -> a, LinkedHashMap::new));
        this.byRole = players.stream().collect(Collectors.groupingBy(Player::role,
                Collectors.collectingAndThen(Collectors.toList(), List::copyOf)));
        this.statsByPlayer = stats.stream()
                .collect(Collectors.groupingBy(SeasonStats::playerId,
                        Collectors.collectingAndThen(Collectors.toList(), List::copyOf)));
    }

    @Override
    public Optional<Player> byId(String playerId) {
        return Optional.ofNullable(byId.get(playerId));
    }

    @Override
    public List<Player> all() {
        return List.copyOf(byId.values());
    }

    @Override
    public List<Player> byRole(Role role) {
        return byRole.getOrDefault(role, List.of());
    }

    @Override
    public List<SeasonStats> statsOf(String playerId) {
        return statsByPlayer.getOrDefault(playerId, List.of()).stream()
                .sorted(Comparator.comparing(SeasonStats::season).reversed())
                .toList();
    }

    @Override
    public Role roleOf(String playerId) {
        Player player = byId.get(playerId);
        if (player == null) {
            throw new IllegalArgumentException("unknown player id: " + playerId);
        }
        return player.role();
    }
}
