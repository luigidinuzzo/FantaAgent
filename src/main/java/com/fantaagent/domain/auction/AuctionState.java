package com.fantaagent.domain.auction;

import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.player.Role;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

public record AuctionState(
        LeagueRules rules,
        Role currentPhase,
        String myParticipantId,
        Map<String, Squad> squads,
        List<Holding> holdings) {

    public AuctionState {
        squads = Map.copyOf(squads);
        holdings = List.copyOf(holdings);
    }

    public Squad squadOf(String participantId) {
        Squad squad = squads.get(participantId);
        if (squad == null) {
            throw new IllegalArgumentException("unknown participant: " + participantId);
        }
        return squad;
    }

    public Squad mySquad() {
        return squadOf(myParticipantId);
    }

    /**
     * Slot ancora scoperti per quel ruolo sommati su TUTTI i partecipanti, non solo sui
     * miei: e' la domanda "questa fase ha ancora senso" — se nessuno puo' piu' prendere
     * un giocatore di quel ruolo, restare in quella fase non porta a nulla.
     */
    public int slotsRemainingFor(Role role) {
        return squads.values().stream().mapToInt(squad -> squad.slotsRemaining(role)).sum();
    }

    /** Vero quando nessun partecipante ha piu' uno slot libero per quel ruolo. */
    public boolean isPhaseComplete(Role role) {
        return slotsRemainingFor(role) == 0;
    }

    public Set<String> soldPlayerIds() {
        return holdings.stream().map(Holding::playerId).collect(Collectors.toUnmodifiableSet());
    }
}
