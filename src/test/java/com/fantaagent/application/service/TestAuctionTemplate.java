package com.fantaagent.application.service;

import com.fantaagent.application.port.out.AuctionTemplate;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.config.ScoringSettings;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.league.ScoringRules;
import com.fantaagent.domain.player.Role;

import java.util.List;
import java.util.Map;

/** Il modello di un'asta, con campi pubblici: un test cambia quello che gli serve. */
final class TestAuctionTemplate implements AuctionTemplate {

    LeagueRulesSettings rules = new LeagueRulesSettings(100,
            Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1));
    List<Participant> participants = List.of(
            new Participant("me", "Io", 'I', true),
            new Participant("marco", "Marco", 'M', false));
    ScoringSettings scoring;
    AuctionSettings bidder = AuctionSettings.DEFAULTS;

    TestAuctionTemplate(ScoringSettings scoring) {
        this.scoring = scoring;
    }

    @Override public LeagueRulesSettings rules() { return rules; }
    @Override public List<Participant> participants() { return participants; }
    @Override public ScoringSettings scoring() { return scoring; }
    @Override public AuctionSettings bidder() { return bidder; }
    @Override public ScoringRules scoringRules(ScoringSettings settings) {
        return settings.toScoringRules(0.55);
    }
}
