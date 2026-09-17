package com.fantaagent.application.service;

import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.config.ScoringSettings;
import com.fantaagent.domain.league.Participant;

import java.util.List;
import java.util.Objects;

/** Tutto cio' che serve a creare un'asta, gia' validato da chi la chiede. */
public record AuctionSetup(String name, LeagueRulesSettings rules, List<Participant> participants,
                           ScoringSettings scoring, AuctionSettings bidder) {

    public AuctionSetup {
        Objects.requireNonNull(rules, "rules");
        Objects.requireNonNull(scoring, "scoring");
        Objects.requireNonNull(bidder, "bidder");
        participants = List.copyOf(participants);
    }
}
