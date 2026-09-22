package com.fantaagent.domain.auction;

import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.player.RoleLookup;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Piega il log degli eventi nello stato corrente. Funzione pura: stessi eventi,
 * stesso stato. È il solo modo di costruire un {@link AuctionState}.
 */
public final class AuctionProjector {

    private AuctionProjector() {
    }

    public static AuctionState project(LeagueRules rules, List<Participant> participants,
                                       RoleLookup roles, List<AuctionEvent> events) {
        Map<Long, Holding> active = new LinkedHashMap<>();
        Role currentPhase = rules.firstPhase();

        for (AuctionEvent event : events) {
            switch (event) {
                case AuctionEvent.AuctionStarted ignored -> {
                    // nessun effetto sullo stato derivato
                }
                case AuctionEvent.AuctionRenamed ignored -> {
                    // il nome non entra nello stato derivato
                }
                case AuctionEvent.PhaseAdvanced advanced -> currentPhase = advanced.role();
                case AuctionEvent.PlayerPurchased purchased -> active.put(purchased.seq(),
                        new Holding(purchased.seq(), purchased.playerId(),
                                roles.roleOf(purchased.playerId()),
                                purchased.participantId(), purchased.price()));
                case AuctionEvent.PurchaseRevoked revoked -> active.remove(revoked.targetSeq());
                case AuctionEvent.PurchaseCorrected corrected -> active.computeIfPresent(
                        corrected.targetSeq(),
                        (seq, holding) -> new Holding(holding.seq(), holding.playerId(),
                                holding.role(), corrected.newParticipantId(), corrected.newPrice()));
            }
        }

        List<Holding> holdings = List.copyOf(active.values());
        Map<String, Squad> squads = new LinkedHashMap<>();
        for (Participant participant : participants) {
            List<Holding> owned = holdings.stream()
                    .filter(h -> h.participantId().equals(participant.id()))
                    .toList();
            squads.put(participant.id(), new Squad(participant.id(), owned, rules));
        }

        String me = participants.stream()
                .filter(Participant::me)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("no participant flagged as me"))
                .id();

        return new AuctionState(rules, currentPhase, me, squads, holdings);
    }
}
