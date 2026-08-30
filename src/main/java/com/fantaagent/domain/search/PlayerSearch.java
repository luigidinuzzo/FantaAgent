package com.fantaagent.domain.search;

import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.function.ToDoubleFunction;

/**
 * Ricerca per nome, tollerante ai refusi, con ranking che pesa la qualità del match e
 * la rilevanza del giocatore. Durante l'asta si digitano tre lettere e si guarda solo
 * il primo risultato: il ranking conta quanto il match.
 */
public final class PlayerSearch {

    private static final int SCORE_EXACT = 1000;
    private static final int SCORE_PREFIX = 800;
    private static final int SCORE_WORD_PREFIX = 700;
    private static final int SCORE_TYPO = 500;
    private static final int SCORE_CONTAINS = 400;
    private static final int PHASE_BOOST = 250;
    private static final double RELEVANCE_CAP = 200.0;
    private static final double RELEVANCE_DIVISOR = 3.0;

    private record Indexed(Player player, String normalizedName) {
    }

    private final List<Indexed> index;
    private final ToDoubleFunction<String> relevanceOf;

    public PlayerSearch(List<Player> players, ToDoubleFunction<String> relevanceOf) {
        this.index = players.stream()
                .map(p -> new Indexed(p, TextNormalizer.normalize(p.name())))
                .toList();
        this.relevanceOf = relevanceOf;
    }

    public List<Player> search(String query, Role phaseBoost, int limit) {
        String q = TextNormalizer.normalize(query);
        if (q.isBlank()) {
            return List.of();
        }
        record Scored(Player player, double score) {
        }
        List<Scored> scored = new ArrayList<>();
        for (Indexed indexed : index) {
            int matchScore = matchScore(q, indexed.normalizedName());
            if (matchScore == 0) {
                continue;
            }
            double relevance = Math.min(RELEVANCE_CAP,
                    relevanceOf.applyAsDouble(indexed.player().id()) / RELEVANCE_DIVISOR);
            double boost = phaseBoost != null && indexed.player().role() == phaseBoost
                    ? PHASE_BOOST : 0;
            scored.add(new Scored(indexed.player(), matchScore + relevance + boost));
        }
        return scored.stream()
                .sorted(Comparator.comparingDouble(Scored::score).reversed())
                .limit(limit)
                .map(Scored::player)
                .toList();
    }

    private static int matchScore(String query, String name) {
        if (name.equals(query)) {
            return SCORE_EXACT;
        }
        if (name.startsWith(query)) {
            return SCORE_PREFIX;
        }
        for (String token : name.split(" ")) {
            if (token.startsWith(query)) {
                return SCORE_WORD_PREFIX;
            }
        }
        for (String token : name.split(" ")) {
            if (TextNormalizer.editDistanceAtMostOne(query, token)) {
                return SCORE_TYPO;
            }
        }
        if (name.contains(query)) {
            return SCORE_CONTAINS;
        }
        return 0;
    }
}
