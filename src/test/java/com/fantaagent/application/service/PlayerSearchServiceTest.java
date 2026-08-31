package com.fantaagent.application.service;

import com.fantaagent.adapter.out.file.InMemoryPlayerCatalog;
import com.fantaagent.adapter.out.file.JsonlAuctionEventStore;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.ModifierTable;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.league.ScoringRules;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.strategy.ModifierCalculator;
import com.fantaagent.domain.strategy.RosterCompleter;
import com.fantaagent.domain.strategy.ValuationEngine;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * S3: {@code targets()} prefiltrava per soli punti base e ordinava per margine solo
 * dopo, quindi un giocatore economico con margine grande non poteva mai comparire nella
 * lista se il taglio sui punti lo scartava prima. Questo test costruisce esattamente
 * quella situazione: molti giocatori costosi con punti identici (che da soli
 * riempirebbero qualunque taglio ai primi 15 per punti) e un occasione economica con
 * punti più bassi ma un rapporto punti/prezzo nettamente migliore.
 */
class PlayerSearchServiceTest {

    @TempDir
    Path tmp;

    private static final ModifierTable FLAT = new ModifierTable(1,
            List.of(new ModifierTable.Threshold(0.0, 0.0)));

    private static final ScoringRules SCORING = new ScoringRules(true,
            Map.of(Role.P, 3.0, Role.D, 4.0, Role.C, 3.5, Role.A, 3.0),
            1.0, 3.0, -3.0, 3.0, -0.5, -1.0, -1.0, 1.0, FLAT, FLAT);

    private static final LeagueRules RULES = new LeagueRules(2, 500,
            Map.of(Role.P, 1, Role.D, 25, Role.C, 1, Role.A, 1),
            List.of(Role.D, Role.P, Role.C, Role.A));

    private static final List<Participant> PARTICIPANTS = List.of(
            new Participant("me", "Io", 'I', true),
            new Participant("marco", "Marco", 'M', false));

    @Test
    void aCheapPlayerWithALargeMarginCanStillAppearAmongTheTargets() {
        List<Player> players = new ArrayList<>();
        // 20 giocatori "costosi": senza storico statistico, la proiezione ricade sulla
        // media di ruolo (6.0) per 26 presenze prior (quotazione >= 12) = 156 punti
        // base ciascuno. Da soli riempiono qualunque taglio ai primi 15 per punti base:
        // sotto il vecchio prefiltro l'occasione economica non sarebbe mai stata vista.
        for (int i = 0; i < 20; i++) {
            players.add(new Player("costoso" + i, "Costoso " + i, "Squadra", Role.D, 30));
        }
        // 1 occasione: quotazione bassa (< 12 -> 10 presenze prior) = 60 punti base,
        // ma un rapporto punti/prezzo molto più alto delle alternative costose.
        players.add(new Player("occasione", "Occasione", "Squadra", Role.D, 1));

        PlayerCatalog catalog = new InMemoryPlayerCatalog(players, List.of());
        AuctionService auction = new AuctionService(RULES, PARTICIPANTS, catalog,
                new JsonlAuctionEventStore(tmp.resolve("events.jsonl")));

        ProjectionRegistry projections = ProjectionRegistry.build(RULES, SCORING, catalog);
        ModifierCalculator modifiers = new ModifierCalculator(SCORING, projections.replacement());
        RosterCompleter completer = new RosterCompleter(modifiers, projections.replacement());
        ValuationEngine engine = new ValuationEngine(completer, modifiers);
        PlayerAnalysisService analysis =
                new PlayerAnalysisService(RULES, catalog, projections, engine, auction);
        PlayerSearchService search = new PlayerSearchService(catalog, projections, auction, analysis);

        List<PlayerSearchService.TargetRow> result = search.targets(20);

        assertThat(result).extracting(row -> row.player().id()).contains("occasione");
    }
}
