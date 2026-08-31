package com.fantaagent.adapter.in.web.dto;

import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.strategy.PriceRecommendation;

import java.util.List;
import java.util.Map;

public final class ViewModels {

    private ViewModels() {
    }

    public record BoardRow(String name, char initial, int budget, String composition,
                           int slotsLeft, boolean me) {
    }

    public record StatusBar(String phase, int soldInPhase, int myBudget,
                            String myComposition, int mySlotsLeft, boolean canUndo) {
    }

    public record Analysis(Player player, PriceRecommendation recommendation) {

        public String verdict() {
            if (recommendation.maxBid() == 0) {
                return "LASCIA";
            }
            return recommendation.margin() >= 0 ? "PRENDI" : "LASCIA";
        }

        public String marginLabel() {
            int margin = recommendation.margin();
            return (margin >= 0 ? "+" : "") + margin;
        }
    }

    public record MainPanel(List<Player> results, Analysis analysis, String message) {
    }

    /** Una riga della pagina di riepilogo: un giocatore posseduto e il prezzo pagato. */
    public record RecapPlayer(long seq, String name, int price) {
    }

    /**
     * Una colonna della pagina di riepilogo: un partecipante, i crediti e gli slot che
     * gli restano, e i suoi giocatori raggruppati per ruolo nell'ordine P, D, C, A.
     */
    public record RecapColumn(String participantId, String participantName, boolean me,
                              int budgetRemaining, int slotsRemaining,
                              Map<Role, List<RecapPlayer>> byRole) {
    }
}
