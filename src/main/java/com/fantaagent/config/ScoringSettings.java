package com.fantaagent.config;

import com.fantaagent.domain.league.ModifierTable;
import com.fantaagent.domain.league.ScoringRules;
import com.fantaagent.domain.player.Role;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Impostazioni di punteggio modificabili dall'utente.
 *
 * <p>Vive in {@code config} e non nel dominio di proposito: è la forma "grezza" che
 * arriva dal form e dal file su disco, dove un valore può essere ancora incoerente.
 * Solo {@link #toScoringRules()} produce il tipo di dominio, che è immutabile e valida
 * i propri invarianti.
 *
 * <p>La lega usa un solo modificatore, quello di difesa, calcolato sulla media di
 * portiere più i migliori difensori. Il secondo modificatore previsto dal motore viene
 * quindi emesso neutro: il portiere resta prezioso perché la sua media entra nel
 * reparto, ma non ha una tabella propria.
 */
public record ScoringSettings(
        boolean defenceModifierEnabled,
        int defendersCounted,
        List<Step> thresholds,
        Map<Role, Double> goalBonus,
        double assist,
        double penaltyScored,
        double penaltyMissed,
        double penaltySaved,
        double yellowCard,
        double redCard,
        double goalConceded,
        double cleanSheet,
        boolean confirmed) {

    /** Una riga della tabella: da questa media in su, questo bonus. */
    public record Step(double minAverage, double bonus) {
    }

    public ScoringSettings {
        thresholds = List.copyOf(thresholds);
        goalBonus = Map.copyOf(goalBonus);
    }

    /**
     * Tabella neutra: un solo gradino a zero, che vale zero. Serve sia quando il
     * modificatore è disattivato sia per il modificatore portiere, che questa lega
     * non usa.
     */
    private static ModifierTable neutralTable(int defendersCounted) {
        return new ModifierTable(defendersCounted,
                List.of(new ModifierTable.Threshold(0.0, 0.0)));
    }

    /** Equivalente a {@link #toScoringRules(double)} con sigma zero (nessuna dispersione di giornata). */
    public ScoringRules toScoringRules() {
        return toScoringRules(0.0);
    }

    /**
     * @param matchdayRatingSigma deviazione standard della media voto di giornata,
     *                            vedi {@code league.scoring.matchday-rating-sigma}
     *                            in application.yml; non fa parte delle impostazioni
     *                            modificabili dall'utente, viene solo dalla configurazione.
     */
    public ScoringRules toScoringRules(double matchdayRatingSigma) {
        ModifierTable defence = defenceModifierEnabled
                ? new ModifierTable(defendersCounted, toDomainThresholds())
                : neutralTable(defendersCounted);
        return new ScoringRules(confirmed, goalBonus, assist,
                penaltyScored, penaltyMissed, penaltySaved,
                yellowCard, redCard, goalConceded, cleanSheet,
                defence, neutralTable(0), matchdayRatingSigma);
    }

    /**
     * Il motore cerca il gradino più alto raggiunto, quindi la tabella deve partire da
     * una soglia che copre qualunque media. Se l'utente non l'ha inserita la aggiungiamo
     * noi a bonus zero, invece di rifiutare una tabella che è di fatto corretta.
     */
    private List<ModifierTable.Threshold> toDomainThresholds() {
        List<ModifierTable.Threshold> rows = new ArrayList<>();
        if (thresholds.isEmpty() || thresholds.getFirst().minAverage() > 0.0) {
            rows.add(new ModifierTable.Threshold(0.0, 0.0));
        }
        thresholds.forEach(s -> rows.add(new ModifierTable.Threshold(s.minAverage(), s.bonus())));
        return rows;
    }

    public static ScoringSettings from(ScoringRules rules, boolean defenceEnabled) {
        List<Step> steps = rules.defenceModifier().thresholds().stream()
                .map(t -> new Step(t.minAverage(), t.bonus()))
                .toList();
        Map<Role, Double> bonus = new EnumMap<>(Role.class);
        for (Role role : Role.values()) {
            bonus.put(role, rules.goalBonus(role));
        }
        return new ScoringSettings(defenceEnabled,
                rules.defenceModifier().defendersCounted(), steps, bonus,
                rules.assist(), rules.penaltyScored(), rules.penaltyMissed(),
                rules.penaltySaved(), rules.yellowCard(), rules.redCard(),
                rules.goalConceded(), rules.cleanSheet(), rules.modifiersConfirmed());
    }
}
