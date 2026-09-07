package com.fantaagent.adapter.in.api.dto;

import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.auction.Squad;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Role;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class StateDtos {

    private StateDtos() {
    }

    /**
     * Un partecipante come lo vede il tabellone: quanto gli resta e quanto ha
     * riempito, ruolo per ruolo.
     *
     * <p>Le due mappe viaggiano separate invece di una stringa gia' composta:
     * la composizione della rosa e' una barra segmentata, e comporre
     * "1P 3D 0C 0A" qui significherebbe costringere l'interfaccia a
     * scomporla di nuovo per disegnarla.
     */
    public record ParticipantView(String id, String name, String initial, boolean me,
                                  int budgetRemaining, int slotsRemaining,
                                  Map<Role, Integer> filledByRole,
                                  Map<Role, Integer> slotsByRole) {
    }

    public record AuctionStateResponse(String auctionId, String auctionName,
                                       Role currentPhase, List<Role> phases,
                                       int soldInPhase, String myParticipantId,
                                       boolean canUndo,
                                       List<ParticipantView> participants) {
    }

    public static AuctionStateResponse from(String auctionId, String auctionName,
                                            AuctionState state, List<Participant> participants,
                                            int soldInPhase) {
        List<ParticipantView> views = participants.stream()
                .map(p -> view(p, state.squadOf(p.id()), state))
                .toList();
        return new AuctionStateResponse(auctionId, auctionName, state.currentPhase(),
                state.rules().phases(), soldInPhase, state.myParticipantId(),
                !state.holdings().isEmpty(), views);
    }

    private static ParticipantView view(Participant p, Squad squad, AuctionState state) {
        Map<Role, Integer> filled = new LinkedHashMap<>();
        Map<Role, Integer> total = new LinkedHashMap<>();
        for (Role role : Role.values()) {
            filled.put(role, squad.count(role));
            total.put(role, state.rules().slots(role));
        }
        return new ParticipantView(p.id(), p.name(), String.valueOf(p.initial()), p.me(),
                squad.budgetRemaining(), squad.slotsRemaining(), filled, total);
    }
}
