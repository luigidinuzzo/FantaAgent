package com.fantaagent.application.port.out;

import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.config.ScoringSettings;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.league.ScoringRules;

import java.util.List;

/**
 * Il modello da cui parte un'asta, e il ripiego per le aste che non hanno un file.
 *
 * <p>Riletto a ogni chiamata, non fotografato all'avvio: le pagine /legacy riscrivono
 * ancora i file globali, e il modello deve dire quello che c'e' su disco adesso.
 */
public interface AuctionTemplate {

    LeagueRulesSettings rules();

    List<Participant> participants();

    ScoringSettings scoring();

    AuctionSettings bidder();

    /** Le regole di punteggio del dominio: la sigma delle medie e' configurazione. */
    ScoringRules scoringRules(ScoringSettings settings);
}
