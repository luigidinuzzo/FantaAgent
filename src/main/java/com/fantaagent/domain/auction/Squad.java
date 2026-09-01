package com.fantaagent.domain.auction;

import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.player.Role;

import java.util.ArrayList;
import java.util.List;

public record Squad(String participantId, List<Holding> holdings, LeagueRules rules) {

    public Squad {
        holdings = List.copyOf(holdings);
    }

    public int spent() {
        return holdings.stream().mapToInt(Holding::price).sum();
    }

    public int budgetRemaining() {
        return rules.budget() - spent();
    }

    public int count(Role role) {
        return (int) holdings.stream().filter(h -> h.role() == role).count();
    }

    public int slotsRemaining(Role role) {
        return Math.max(0, rules.slots(role) - count(role));
    }

    public int slotsRemaining() {
        int total = 0;
        for (Role role : Role.values()) {
            total += slotsRemaining(role);
        }
        return total;
    }

    public boolean hasRoom(Role role) {
        return slotsRemaining(role) > 0;
    }

    /**
     * Massimo spendibile su un singolo giocatore adesso: ogni altro slot ancora
     * scoperto costa almeno 1 credito. Invariante di budget della spec.
     */
    public int maxSpendableNow() {
        int slots = slotsRemaining();
        if (slots == 0) {
            return 0;
        }
        return Math.max(0, budgetRemaining() - (slots - 1));
    }

    public Squad with(Holding holding) {
        List<Holding> next = new ArrayList<>(holdings);
        next.add(holding);
        return new Squad(participantId, next, rules);
    }

    public List<String> playerIds() {
        return holdings.stream().map(Holding::playerId).toList();
    }
}
