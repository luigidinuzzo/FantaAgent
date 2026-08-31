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
import com.fantaagent.domain.player.SeasonStats;
import com.fantaagent.domain.strategy.ModifierCalculator;
import com.fantaagent.domain.strategy.RosterCompleter;
import com.fantaagent.domain.strategy.ValuationEngine;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Misura {@code targets()} su un fixture realistico invece di ragionare a stima: il
 * progetto è già stato tradito tre volte da stime ottimistiche che la misura ha
 * smentito (un architecture test che non controllava nulla, un test di latenza su otto
 * giocatori, un argomento sulla shortlist rivelatosi falso). Il budget di 1 secondo
 * riguarda un catalogo da ~600 giocatori, lega da 8 partecipanti/500 crediti, a metà
 * asta con 70 giocatori già venduti — la scala reale in cui {@code targets()} gira.
 */
class PlayerSearchServiceLatencyTest {

    @TempDir
    Path tmp;

    private static final ModifierTable FLAT = new ModifierTable(1,
            List.of(new ModifierTable.Threshold(0.0, 0.0)));

    private static final ScoringRules SCORING = new ScoringRules(true,
            Map.of(Role.P, 3.0, Role.D, 4.0, Role.C, 3.5, Role.A, 3.0),
            1.0, 3.0, -3.0, 3.0, -0.5, -1.0, -1.0, 1.0, FLAT, FLAT, 0.0);

    private static final LeagueRules RULES = new LeagueRules(8, 500,
            Map.of(Role.P, 3, Role.D, 8, Role.C, 8, Role.A, 6),
            List.of(Role.P, Role.D, Role.C, Role.A));

    @Test
    void targetsStaysUnderOneSecondAtRealisticScale() {
        List<Participant> participants = new ArrayList<>();
        participants.add(new Participant("me", "Io", 'I', true));
        for (int i = 1; i <= 7; i++) {
            participants.add(new Participant("riv" + i, "Rivale " + i, (char) ('A' + i), false));
        }
        List<String> rivalIds = participants.stream()
                .map(Participant::id)
                .filter(id -> !id.equals("me"))
                .toList();

        Random random = new Random(20260830L);
        List<Player> players = new ArrayList<>();
        List<SeasonStats> stats = new ArrayList<>();
        // Proporzioni del listone reale: ~60 portieri, ~200 difensori, ~200
        // centrocampisti, ~140 attaccanti, per un totale di circa 600 giocatori.
        seedGroup(players, stats, random, Role.P, "gk", 60, 40);
        seedGroup(players, stats, random, Role.D, "df", 200, 25);
        seedGroup(players, stats, random, Role.C, "mf", 200, 22);
        seedGroup(players, stats, random, Role.A, "fw", 140, 30);

        PlayerCatalog catalog = new InMemoryPlayerCatalog(players, stats);

        JsonlAuctionEventStore store = new JsonlAuctionEventStore(tmp.resolve("events.jsonl"));
        AuctionService auction = new AuctionService(RULES, participants, catalog, store);

        // Stato di metà asta: i migliori giocatori di ogni ruolo (generati per primi,
        // quindi i piu' quotati) sono gia' venduti, distribuiti sui 7 rivali. "me" non
        // ha ancora comprato nulla. Sold totali: 8 + 23 + 22 + 17 = 70.
        Map<Role, Integer> soldPerRole = Map.of(Role.P, 8, Role.D, 23, Role.C, 22, Role.A, 17);
        Map<Role, String> prefixOf = Map.of(Role.P, "gk", Role.D, "df", Role.C, "mf", Role.A, "fw");
        int rival = 0;
        for (Role role : List.of(Role.P, Role.D, Role.C, Role.A)) {
            String prefix = prefixOf.get(role);
            int count = soldPerRole.get(role);
            for (int i = 0; i < count; i++) {
                String playerId = prefix + i;
                int listPrice = players.stream()
                        .filter(p -> p.id().equals(playerId))
                        .findFirst().orElseThrow()
                        .listPrice();
                auction.recordPurchase(playerId, rivalIds.get(rival % rivalIds.size()), listPrice);
                rival++;
            }
        }
        assertThat(auction.state().soldPlayerIds()).hasSize(70);

        ProjectionRegistry projections = ProjectionRegistry.build(RULES, SCORING, catalog, List.of(0.5, 0.3, 0.2));
        ModifierCalculator modifiers = new ModifierCalculator(SCORING, projections.replacement());
        RosterCompleter completer = new RosterCompleter(modifiers, projections.replacement());
        ValuationEngine engine = new ValuationEngine(completer, modifiers);
        PlayerAnalysisService analysis =
                new PlayerAnalysisService(RULES, catalog, projections, engine, auction);
        PlayerSearchService search = new PlayerSearchService(catalog, projections, auction, analysis);

        search.targets(10); // riscaldamento della JIT
        search.targets(10);

        long start = System.nanoTime();
        List<PlayerSearchService.TargetRow> result = search.targets(10);
        long millis = (System.nanoTime() - start) / 1_000_000;

        System.out.println("targets(10) su ~600 giocatori a meta' asta: " + millis + " ms");

        assertThat(result).isNotEmpty();
        assertThat(millis).isLessThan(1000L);
    }

    /**
     * Il max bid costa circa 45 ms/giocatore e la fase corrente conta fino a ~200
     * giocatori (i difensori del fixture qui sotto): renderlo per tutti supererebbe
     * gli otto secondi, da cui il limite di batch. Misura sulla stessa scala di
     * {@link #targetsStaysUnderOneSecondAtRealisticScale}.
     */
    @Test
    void phasePlayersStaysUnderOnePointFiveSecondsForOneBatchAtRealisticScale() {
        List<Participant> participants = new ArrayList<>();
        participants.add(new Participant("me", "Io", 'I', true));
        for (int i = 1; i <= 7; i++) {
            participants.add(new Participant("riv" + i, "Rivale " + i, (char) ('A' + i), false));
        }
        List<String> rivalIds = participants.stream()
                .map(Participant::id)
                .filter(id -> !id.equals("me"))
                .toList();

        Random random = new Random(20260831L);
        List<Player> players = new ArrayList<>();
        List<SeasonStats> stats = new ArrayList<>();
        seedGroup(players, stats, random, Role.P, "gk", 60, 40);
        seedGroup(players, stats, random, Role.D, "df", 200, 25);
        seedGroup(players, stats, random, Role.C, "mf", 200, 22);
        seedGroup(players, stats, random, Role.A, "fw", 140, 30);

        PlayerCatalog catalog = new InMemoryPlayerCatalog(players, stats);

        JsonlAuctionEventStore store = new JsonlAuctionEventStore(tmp.resolve("events-phase.jsonl"));
        AuctionService auction = new AuctionService(RULES, participants, catalog, store);

        Map<Role, Integer> soldPerRole = Map.of(Role.P, 8, Role.D, 23, Role.C, 22, Role.A, 17);
        Map<Role, String> prefixOf = Map.of(Role.P, "gk", Role.D, "df", Role.C, "mf", Role.A, "fw");
        int rival = 0;
        for (Role role : List.of(Role.P, Role.D, Role.C, Role.A)) {
            String prefix = prefixOf.get(role);
            int count = soldPerRole.get(role);
            for (int i = 0; i < count; i++) {
                String playerId = prefix + i;
                int listPrice = players.stream()
                        .filter(p -> p.id().equals(playerId))
                        .findFirst().orElseThrow()
                        .listPrice();
                auction.recordPurchase(playerId, rivalIds.get(rival % rivalIds.size()), listPrice);
                rival++;
            }
        }

        ProjectionRegistry projections = ProjectionRegistry.build(RULES, SCORING, catalog, List.of(0.5, 0.3, 0.2));
        ModifierCalculator modifiers = new ModifierCalculator(SCORING, projections.replacement());
        RosterCompleter completer = new RosterCompleter(modifiers, projections.replacement());
        ValuationEngine engine = new ValuationEngine(completer, modifiers);
        PlayerAnalysisService analysis =
                new PlayerAnalysisService(RULES, catalog, projections, engine, auction);
        PlayerSearchService search = new PlayerSearchService(catalog, projections, auction, analysis);

        search.phasePlayers(0, PlayerSearchService.PHASE_PAGE_SIZE); // riscaldamento della JIT
        search.phasePlayers(0, PlayerSearchService.PHASE_PAGE_SIZE);

        long start = System.nanoTime();
        PlayerSearchService.PhasePage page = search.phasePlayers(0, PlayerSearchService.PHASE_PAGE_SIZE);
        long millis = (System.nanoTime() - start) / 1_000_000;

        System.out.println("phasePlayers(" + PlayerSearchService.PHASE_PAGE_SIZE
                + ") su ~600 giocatori a meta' asta: " + millis + " ms");

        assertThat(page.rows()).hasSize(PlayerSearchService.PHASE_PAGE_SIZE);
        assertThat(millis).isLessThan(1500L);
    }

    private static void seedGroup(List<Player> playersOut, List<SeasonStats> statsOut, Random random,
                                  Role role, String prefix, int count, double topListPrice) {
        for (int i = 0; i < count; i++) {
            String id = prefix + i;
            int listPrice = Math.max(1, (int) Math.round(topListPrice * (1.0 - (double) i / count))
                    + random.nextInt(5) - 2);
            playersOut.add(new Player(id, "Giocatore " + id, "Squadra " + (i % 20), role, listPrice));

            int appearances = 15 + random.nextInt(24);
            double rating = 5.5 + random.nextDouble() * 1.2;
            int goals = role == Role.A ? random.nextInt(20)
                    : role == Role.C ? random.nextInt(8)
                    : random.nextInt(2);
            int assists = random.nextInt(8);
            statsOut.add(new SeasonStats(id, "2025-26", appearances, rating, goals, assists,
                    random.nextInt(6), 0,
                    role == Role.A ? random.nextInt(4) : 0, 0,
                    role == Role.P ? random.nextInt(3) : 0,
                    role == Role.P ? 20 + random.nextInt(20) : 0,
                    role == Role.P ? random.nextInt(15) : 0));
        }
    }
}
