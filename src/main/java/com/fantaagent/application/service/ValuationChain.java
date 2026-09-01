package com.fantaagent.application.service;

import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.ScoringRules;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.strategy.ModifierCalculator;
import com.fantaagent.domain.strategy.RosterCompleter;
import com.fantaagent.domain.strategy.ValuationEngine;

import java.util.List;
import java.util.function.UnaryOperator;

/**
 * La catena che discende dalle regole di punteggio: proiezioni di tutti i giocatori,
 * livelli di rimpiazzo, calcolo dei modificatori, completamento rosa, motore di prezzo.
 *
 * <p>Esiste come oggetto unico perché il modo peggiore di sbagliare, qui, è mescolarne
 * i pezzi: proiezioni calcolate con le regole nuove valutate contro livelli di rimpiazzo
 * ricavati da quelle vecchie darebbero numeri verdi, plausibili e falsi, che nessuno
 * potrebbe accorgersi di stare leggendo. Per questo:
 *
 * <ul>
 *   <li>è un record immutabile: costruito una volta, mai modificato a pezzi;</li>
 *   <li>il costruttore canonico RIFIUTA una catena mescolata — verifica per identità
 *       che proiezioni e motore derivino dalle stesse regole e dagli stessi livelli di
 *       rimpiazzo. Una catena incoerente non è rappresentabile, non solo improbabile;</li>
 *   <li>{@link AuctionRuntime} la pubblica con una sola scrittura su un campo volatile,
 *       dopo averla costruita per intero.</li>
 * </ul>
 */
public record ValuationChain(ScoringRules scoring, ProjectionRegistry projections,
                             ValuationEngine engine) {

    public ValuationChain {
        if (projections.scoring() != scoring) {
            throw new IllegalArgumentException(
                    "projections were built from different scoring rules than the chain's");
        }
        if (engine.modifiers().scoring() != scoring) {
            throw new IllegalArgumentException(
                    "the engine's modifier calculator uses different scoring rules than the chain's");
        }
        if (engine.modifiers().replacement() != projections.replacement()) {
            throw new IllegalArgumentException(
                    "the engine's modifier calculator uses different replacement levels than the projections'");
        }
        if (engine.completer().replacement() != projections.replacement()) {
            throw new IllegalArgumentException(
                    "the engine's roster completer uses different replacement levels than the projections'");
        }
    }

    /** Costruisce l'intera catena. È l'unico punto in cui i pezzi vengono messi insieme. */
    public static ValuationChain build(LeagueRules rules, ScoringRules scoring,
                                       PlayerCatalog catalog, List<Double> seasonWeights) {
        ProjectionRegistry projections =
                ProjectionRegistry.build(rules, scoring, catalog, seasonWeights);
        ModifierCalculator modifiers = new ModifierCalculator(scoring, projections.replacement());
        RosterCompleter completer = new RosterCompleter(modifiers, projections.replacement());
        UnaryOperator<String> playerNameResolver =
                id -> catalog.byId(id).map(Player::name).orElse(id);
        return new ValuationChain(scoring, projections,
                new ValuationEngine(completer, modifiers, playerNameResolver));
    }
}
