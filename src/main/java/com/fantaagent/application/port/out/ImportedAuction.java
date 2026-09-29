package com.fantaagent.application.port.out;

import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.config.ScoringSettings;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.league.Participant;

import java.util.List;

/** Un'asta letta dalla cartella del jar di prima, con i ripieghi sul modello gia' applicati. */
public record ImportedAuction(String name, List<Participant> participants, LeagueRulesSettings rules,
                              ScoringSettings scoring, AuctionSettings bidder, List<AuctionEvent> events) {
}
