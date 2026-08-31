package com.fantaagent.config;

import com.fantaagent.domain.league.ScoringRules;
import com.fantaagent.domain.player.Role;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Aggancia le impostazioni scelte dall'utente al resto dell'applicazione.
 *
 * <p>Il bean di {@link ScoringRules} definito qui è l'unico dell'applicazione: se
 * esiste un file di impostazioni scritto dalla schermata Impostazioni, sono quelle a
 * valere. Altrimenti si ricade sui valori di application.yml, che restano il default
 * del progetto.
 *
 * <p>Le regole di punteggio sono lette una volta sola, all'avvio, perché da esse
 * discendono i punti attesi di tutti i giocatori, i livelli di rimpiazzo e l'intero
 * motore di valutazione. Cambiarle a caldo senza ricostruire quella catena mostrerebbe
 * numeri calcolati con le regole vecchie: verdi, plausibili e sbagliati. Per questo il
 * salvataggio scrive su disco e chiede un riavvio, invece di fingere un aggiornamento
 * immediato.
 */
@Configuration
public class SettingsConfig {

    private static final Logger log = LoggerFactory.getLogger(SettingsConfig.class);

    @Bean
    public ScoringSettingsStore scoringSettingsStore(
            @Value("${fantaagent.data-dir:res}") String dataDir) {
        return new ScoringSettingsStore(Path.of(dataDir));
    }

    @Bean
    public LeagueMembersSettingsStore leagueMembersSettingsStore(
            @Value("${fantaagent.data-dir:res}") String dataDir) {
        return new LeagueMembersSettingsStore(Path.of(dataDir));
    }

    @Bean
    public ScoringRules scoringRules(ScoringSettingsStore store, LeagueProperties props) {
        double sigma = props.scoring().matchdayRatingSigma();
        Optional<ScoringSettings> stored = store.load();
        if (stored.isEmpty()) {
            log.info("impostazioni di lega: nessun {} trovato, uso i valori di application.yml",
                    ScoringSettingsStore.FILE_NAME);
            return fromProperties(props);
        }
        ScoringSettings settings = stored.get();
        List<String> errors = ScoringSettingsValidator.validate(settings);
        if (!errors.isEmpty()) {
            throw new IllegalStateException(
                    "impostazioni di lega non valide in " + store.file() + ":\n  - "
                    + String.join("\n  - ", errors));
        }
        log.info("impostazioni di lega lette da {} (modificatore difesa: {}, soglie: {})",
                store.file(),
                settings.defenceModifierEnabled() ? "attivo" : "disattivo",
                settings.thresholds().size());
        ScoringRules effective = settings.toScoringRules(sigma);
        warnIfApplicationYmlIsIgnored(store, props, effective);
        return effective;
    }

    /**
     * {@code store.file()} vince sempre su application.yml quando esiste: lo segnala a INFO,
     * e se i due file darebbero numeri diversi lo segnala anche a WARN con l'elenco dei
     * valori che differiscono, per non lasciare chi ha modificato application.yml a credere
     * che quel numero sia in vigore.
     */
    private static void warnIfApplicationYmlIsIgnored(
            ScoringSettingsStore store, LeagueProperties props, ScoringRules effective) {
        log.info("regole di punteggio in vigore da {}: i valori di scoring in application.yml "
                + "sono ignorati (application.yml resta letto solo se {} non esiste)",
                store.file(), store.file());
        ScoringRules fromYml = fromProperties(props);
        List<String> differences = scoringDifferences(effective, fromYml);
        if (!differences.isEmpty()) {
            log.warn("i valori di scoring in vigore da {} differiscono da quelli di "
                    + "application.yml (ignorati):\n  - {}",
                    store.file(), String.join("\n  - ", differences));
        }
    }

    private static List<String> scoringDifferences(ScoringRules effective, ScoringRules fromYml) {
        List<String> differences = new ArrayList<>();
        diffValue(differences, "assist", effective.assist(), fromYml.assist());
        diffValue(differences, "rigore segnato", effective.penaltyScored(), fromYml.penaltyScored());
        diffValue(differences, "rigore sbagliato", effective.penaltyMissed(), fromYml.penaltyMissed());
        diffValue(differences, "rigore parato", effective.penaltySaved(), fromYml.penaltySaved());
        diffValue(differences, "ammonizione", effective.yellowCard(), fromYml.yellowCard());
        diffValue(differences, "espulsione", effective.redCard(), fromYml.redCard());
        diffValue(differences, "gol subito", effective.goalConceded(), fromYml.goalConceded());
        diffValue(differences, "porta inviolata", effective.cleanSheet(), fromYml.cleanSheet());
        for (Role role : Role.values()) {
            diffValue(differences, "bonus gol " + role,
                    effective.goalBonus(role), fromYml.goalBonus(role));
        }
        return differences;
    }

    private static void diffValue(List<String> differences, String label,
                                  double effective, double fromYml) {
        if (Double.compare(effective, fromYml) != 0) {
            differences.add(String.format(Locale.ROOT,
                    "%s: in vigore %.3f, in application.yml %.3f", label, effective, fromYml));
        }
    }

    /** Gli stessi valori che costruirebbe la configurazione di progetto, senza file utente. */
    static ScoringRules fromProperties(LeagueProperties props) {
        LeagueProperties.Scoring s = props.scoring();
        return new ScoringRules(
                s.modifiersConfirmed(), s.goalBonus(), s.assist(),
                s.penaltyScored(), s.penaltyMissed(), s.penaltySaved(),
                s.yellowCard(), s.redCard(), s.goalConceded(), s.cleanSheet(),
                toTable(s.defenceModifier()), toTable(s.goalkeeperModifier()),
                s.matchdayRatingSigma());
    }

    private static com.fantaagent.domain.league.ModifierTable toTable(LeagueProperties.Table t) {
        return new com.fantaagent.domain.league.ModifierTable(t.defendersCounted(),
                t.thresholds().stream()
                        .map(r -> new com.fantaagent.domain.league.ModifierTable.Threshold(
                                r.minAverage(), r.bonus()))
                        .toList());
    }
}
