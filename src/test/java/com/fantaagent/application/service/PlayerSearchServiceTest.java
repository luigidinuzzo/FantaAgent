package com.fantaagent.application.service;

import com.fantaagent.adapter.out.file.InMemoryPlayerCatalog;
import com.fantaagent.adapter.out.file.JsonlAuctionEventStore;
import com.fantaagent.application.port.out.AuctionEventStore;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.domain.auction.AuctionEvent;
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
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.LongFunction;

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
            1.0, 3.0, -3.0, 3.0, -0.5, -1.0, -1.0, 1.0, FLAT, FLAT, 0.0);

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

        ProjectionRegistry projections = ProjectionRegistry.build(RULES, SCORING, catalog, List.of(0.5, 0.3, 0.2));
        ModifierCalculator modifiers = new ModifierCalculator(SCORING, projections.replacement());
        RosterCompleter completer = new RosterCompleter(modifiers, projections.replacement());
        ValuationEngine engine = new ValuationEngine(completer, modifiers);
        PlayerAnalysisService analysis =
                new PlayerAnalysisService(RULES, catalog, projections, engine, auction);
        PlayerSearchService search = new PlayerSearchService(catalog, projections, auction, analysis);

        List<PlayerSearchService.TargetRow> result = search.targets(20);

        assertThat(result).extracting(row -> row.player().id()).contains("occasione");
    }

    @Test
    void phasePlayersOnlyListsAvailablePlayersOfTheCurrentPhaseRankedByExpectedPointsDescending() {
        List<Player> players = new ArrayList<>();
        // Quotazioni diverse -> presenze prior diverse -> punti base diversi (senza
        // storico statistico la proiezione ricade sulla quotazione). "alto" ha la
        // quotazione più alta quindi i punti base più alti, e deve comparire per primo.
        players.add(new Player("basso", "Basso", "Squadra", Role.D, 1));
        players.add(new Player("medio", "Medio", "Squadra", Role.D, 15));
        players.add(new Player("alto", "Alto", "Squadra", Role.D, 30));
        // Ruolo diverso dalla fase corrente (D): non deve comparire.
        players.add(new Player("portiere", "Portiere", "Squadra", Role.P, 30));

        PlayerCatalog catalog = new InMemoryPlayerCatalog(players, List.of());
        AuctionService auction = new AuctionService(RULES, PARTICIPANTS, catalog,
                new JsonlAuctionEventStore(tmp.resolve("events.jsonl")));
        // Già venduto: non deve comparire nemmeno se il ruolo e il resto combaciano.
        auction.recordPurchase("medio", "marco", 15);

        ProjectionRegistry projections = ProjectionRegistry.build(RULES, SCORING, catalog, List.of(0.5, 0.3, 0.2));
        ModifierCalculator modifiers = new ModifierCalculator(SCORING, projections.replacement());
        RosterCompleter completer = new RosterCompleter(modifiers, projections.replacement());
        ValuationEngine engine = new ValuationEngine(completer, modifiers);
        PlayerAnalysisService analysis =
                new PlayerAnalysisService(RULES, catalog, projections, engine, auction);
        PlayerSearchService search = new PlayerSearchService(catalog, projections, auction, analysis);

        PlayerSearchService.PhasePage page = search.phasePlayers(0, 10);

        assertThat(page.rows()).extracting(r -> r.player().id()).containsExactly("alto", "basso");
        assertThat(page.hasMore()).isFalse();
    }

    @Test
    void phasePlayersRespectsTheBatchLimitAndReportsWhetherThereIsMore() {
        List<Player> players = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            players.add(new Player("d" + i, "Difensore " + i, "Squadra", Role.D, 1 + i));
        }

        PlayerCatalog catalog = new InMemoryPlayerCatalog(players, List.of());
        AuctionService auction = new AuctionService(RULES, PARTICIPANTS, catalog,
                new JsonlAuctionEventStore(tmp.resolve("events.jsonl")));

        ProjectionRegistry projections = ProjectionRegistry.build(RULES, SCORING, catalog, List.of(0.5, 0.3, 0.2));
        ModifierCalculator modifiers = new ModifierCalculator(SCORING, projections.replacement());
        RosterCompleter completer = new RosterCompleter(modifiers, projections.replacement());
        ValuationEngine engine = new ValuationEngine(completer, modifiers);
        PlayerAnalysisService analysis =
                new PlayerAnalysisService(RULES, catalog, projections, engine, auction);
        PlayerSearchService search = new PlayerSearchService(catalog, projections, auction, analysis);

        PlayerSearchService.PhasePage firstPage = search.phasePlayers(0, 3);
        assertThat(firstPage.rows()).hasSize(3);
        assertThat(firstPage.hasMore()).isTrue();
        assertThat(firstPage.nextOffset()).isEqualTo(3);

        PlayerSearchService.PhasePage secondPage = search.phasePlayers(3, 3);
        assertThat(secondPage.rows()).hasSize(2);
        assertThat(secondPage.hasMore()).isFalse();
    }

    /**
     * S8: {@code phasePlayers} costruiva un {@link com.fantaagent.domain.strategy.PriceModel}
     * una sola volta per batch, ma valutava ogni riga passando lo stato SOLO fino a
     * {@code PlayerAnalysisService#analyze}, che poi richiamava
     * {@code AuctionService#salesInCurrentPhase()} senza argomenti — quello richiama
     * {@code state()}, che rilegge e rifolda l'intero log a ogni riga. Con un batch di
     * N righe il log veniva quindi caricato N+1 volte (una per la pagina, una per
     * riga), non una sola. Un {@link AuctionEventStore} che conta le {@code load()}
     * verifica che il numero di caricamenti resti basso e indipendente dalla
     * dimensione del batch.
     */
    @Test
    void phasePlayersLoadsTheEventLogOnceRegardlessOfTheBatchSize() {
        List<Player> players = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
            players.add(new Player("d" + i, "Difensore " + i, "Squadra", Role.D, 1 + i));
        }
        PlayerCatalog catalog = new InMemoryPlayerCatalog(players, List.of());

        JsonlAuctionEventStore delegate = new JsonlAuctionEventStore(tmp.resolve("events.jsonl"));
        AtomicInteger loadCalls = new AtomicInteger();
        AuctionEventStore countingStore = new AuctionEventStore() {
            @Override
            public void append(AuctionEvent event) {
                delegate.append(event);
            }

            @Override
            public List<AuctionEvent> load() {
                loadCalls.incrementAndGet();
                return delegate.load();
            }

            @Override
            public long nextSeq() {
                return delegate.nextSeq();
            }

            @Override
            public AuctionEvent appendWithNextSeq(LongFunction<AuctionEvent> eventFactory) {
                return delegate.appendWithNextSeq(eventFactory);
            }

            @Override
            public void backup(String label) {
                delegate.backup(label);
            }
        };

        AuctionService auction = new AuctionService(RULES, PARTICIPANTS, catalog, countingStore);

        ProjectionRegistry projections = ProjectionRegistry.build(RULES, SCORING, catalog, List.of(0.5, 0.3, 0.2));
        ModifierCalculator modifiers = new ModifierCalculator(SCORING, projections.replacement());
        RosterCompleter completer = new RosterCompleter(modifiers, projections.replacement());
        ValuationEngine engine = new ValuationEngine(completer, modifiers);
        PlayerAnalysisService analysis =
                new PlayerAnalysisService(RULES, catalog, projections, engine, auction);
        PlayerSearchService search = new PlayerSearchService(catalog, projections, auction, analysis);

        loadCalls.set(0);
        PlayerSearchService.PhasePage page = search.phasePlayers(0, 12);

        assertThat(page.rows()).hasSize(12);
        // Una lettura sola per l'intera pagina: non una per riga (sarebbero 12+), e
        // non zero (lo stato deve comunque riflettere il log).
        assertThat(loadCalls.get()).isEqualTo(1);
    }
}
