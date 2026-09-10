package com.fantaagent.adapter.in.api.dto;

import com.fantaagent.domain.player.Role;

import java.util.List;
import java.util.Map;

/**
 * Le impostazioni come le vede il client.
 *
 * <p>Rispecchiano i record di {@code config} invece di riusarli: quelli hanno
 * {@code char initial}, che sul filo JSON non esiste, e {@code Map<Role, Double>} con
 * chiavi enum che il client riceve come stringhe. Un DTO separato e' anche il posto in
 * cui un campo puo' cambiare nome per chi legge senza toccare il dominio.
 */
public final class SettingsDtos {

    private SettingsDtos() {
    }

    public record BidderSettings(int bidTimerSeconds, boolean beepEnabled) {
    }

    /** {@code initial} e' una stringa di un carattere: JSON non ha i char. */
    public record ParticipantSettings(String id, String name, String initial, boolean me) {
    }

    public record ScoringStep(double minAverage, double bonus) {
    }

    public record ScoringSection(boolean defenceModifierEnabled, int defendersCounted,
                                 List<ScoringStep> thresholds, Map<Role, Double> goalBonus,
                                 double assist, double penaltyScored, double penaltyMissed,
                                 double penaltySaved, double yellowCard, double redCard,
                                 double goalConceded, double cleanSheet, boolean confirmed) {
    }

    /**
     * @param auctionOpen se un'asta e' aperta. Il client ne ha bisogno per sapere che i
     *                    parametri di punteggio sono bloccati: ad asta iniziata
     *                    cambiarli riscriverebbe i numeri di una rosa gia' pagata.
     */
    public record SettingsResponse(BidderSettings bidder,
                                   List<ParticipantSettings> participants,
                                   ScoringSection scoring,
                                   boolean auctionOpen) {
    }

    public record SaveRequest(String auctionName, BidderSettings bidder,
                              List<ParticipantSettings> participants,
                              ScoringSection scoring) {
    }

    /** @param auctionId l'id dell'asta appena nata, oppure null se ne era gia' aperta una */
    public record SaveResult(String auctionId) {
    }
}
