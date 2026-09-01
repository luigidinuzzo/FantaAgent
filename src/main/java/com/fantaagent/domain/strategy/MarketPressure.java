package com.fantaagent.domain.strategy;

import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.auction.Squad;
import com.fantaagent.domain.player.Role;

import java.util.EnumMap;
import java.util.Map;

/**
 * Quanto gli avversari possono ancora spingere su un ruolo.
 *
 * <p>La scarsità che conta non è quanti giocatori restano, ma quanti avversari hanno
 * ancora bisogno di quel ruolo e i crediti per prenderselo.
 */
public record MarketPressure(Map<Role, Integer> maxRivalBid, Map<Role, Integer> rivalsNeeding) {

    public MarketPressure {
        maxRivalBid = Map.copyOf(maxRivalBid);
        rivalsNeeding = Map.copyOf(rivalsNeeding);
    }

    public static MarketPressure from(AuctionState state) {
        Map<Role, Integer> maxBid = new EnumMap<>(Role.class);
        Map<Role, Integer> needing = new EnumMap<>(Role.class);

        for (Role role : Role.values()) {
            int best = 0;
            int count = 0;
            for (Map.Entry<String, Squad> entry : state.squads().entrySet()) {
                if (entry.getKey().equals(state.myParticipantId())) {
                    continue;
                }
                Squad squad = entry.getValue();
                if (squad.slotsRemaining(role) <= 0) {
                    continue;
                }
                count++;
                best = Math.max(best, squad.maxSpendableNow());
            }
            maxBid.put(role, best);
            needing.put(role, count);
        }
        return new MarketPressure(maxBid, needing);
    }

    public int maxRivalBid(Role role) {
        return maxRivalBid.getOrDefault(role, 0);
    }

    public int rivalsNeeding(Role role) {
        return rivalsNeeding.getOrDefault(role, 0);
    }
}
