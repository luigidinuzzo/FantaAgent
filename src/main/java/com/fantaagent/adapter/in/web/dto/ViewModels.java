package com.fantaagent.adapter.in.web.dto;

import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.strategy.PriceRecommendation;

import java.util.List;

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
}
