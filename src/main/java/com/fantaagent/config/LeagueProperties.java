package com.fantaagent.config;

import com.fantaagent.domain.player.Role;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;
import java.util.Map;

@ConfigurationProperties(prefix = "league")
public record LeagueProperties(
        int participants,
        int budget,
        Map<Role, Integer> slots,
        List<Role> phases,
        List<Member> members,
        Scoring scoring) {

    public record Member(String id, String name, char initial, boolean me) {
    }

    public record Scoring(
            boolean modifiersConfirmed,
            Map<Role, Double> goalBonus,
            double assist,
            double penaltyScored,
            double penaltyMissed,
            double penaltySaved,
            double yellowCard,
            double redCard,
            double goalConceded,
            double cleanSheet,
            Table defenceModifier,
            Table goalkeeperModifier,
            List<Double> seasonWeights) {
    }

    public record Table(int defendersCounted, List<Row> thresholds) {
        public record Row(double minAverage, double bonus) {
        }
    }
}
