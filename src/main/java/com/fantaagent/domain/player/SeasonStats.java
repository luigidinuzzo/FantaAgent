package com.fantaagent.domain.player;

/**
 * Statistiche grezze di una stagione. Nessun bonus è già applicato: la fantamedia
 * viene ricalcolata con le regole della nostra lega, non con quelle della fonte.
 */
public record SeasonStats(
        String playerId,
        String season,
        int appearances,
        double averageRating,
        int goals,
        int assists,
        int yellowCards,
        int redCards,
        int penaltiesScored,
        int penaltiesMissed,
        int penaltiesSaved,
        int goalsConceded,
        int cleanSheets) {
}
