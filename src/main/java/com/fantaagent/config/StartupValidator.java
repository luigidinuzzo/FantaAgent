package com.fantaagent.config;

import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.ModifierTable;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.league.ScoringRules;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Validazione bloccante della configurazione di lega.
 *
 * <p>Politica degli errori: un errore di configurazione deve impedire l'avvio, perché
 * produrrebbe numeri sbagliati per tutta l'asta senza segnalarsi.
 */
@Component
public class StartupValidator {

    private final LeagueRules rules;
    private final ScoringRules scoring;
    private final List<Participant> participants;
    private final boolean devProfile;
    private final PlayerCatalog catalog;
    private final int expectedRosterSize;
    private final String dataDir;

    public StartupValidator(LeagueRules rules, ScoringRules scoring,
                            List<Participant> participants,
                            @Value("${fantaagent.dev-profile:false}") boolean devProfile,
                            PlayerCatalog catalog,
                            @Value("${league.roster-size:25}") int expectedRosterSize,
                            @Value("${fantaagent.data-dir:res}") String dataDir) {
        this.rules = rules;
        this.scoring = scoring;
        this.participants = participants;
        this.devProfile = devProfile;
        this.catalog = catalog;
        this.expectedRosterSize = expectedRosterSize;
        this.dataDir = dataDir;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void validateOnStartup() {
        validate();
    }

    public void validate() {
        if (participants.size() != rules.participants()) {
            throw new IllegalStateException(
                    "il numero di partecipanti configurati (" + participants.size()
                    + ") non corrisponde a league.participants (" + rules.participants() + ")");
        }
        Set<Character> initials = new HashSet<>();
        for (Participant p : participants) {
            if (!initials.add(p.initial())) {
                throw new IllegalStateException(
                        "valore duplicato del campo initial tra i partecipanti: '" + p.initial() + "'");
            }
        }
        long owners = participants.stream().filter(Participant::me).count();
        if (owners != 1) {
            throw new IllegalStateException(
                    "deve esserci esattamente un partecipante con me=true, trovati: " + owners);
        }
        if (rules.rosterSize() < 1) {
            throw new IllegalStateException("la dimensione della rosa deve essere positiva");
        }
        if (rules.rosterSize() != expectedRosterSize) {
            throw new IllegalStateException(
                    "la somma degli slot in league.slots (" + rules.rosterSize()
                    + ") non corrisponde a league.roster-size (" + expectedRosterSize + ")");
        }
        if (rules.budget() < 1) {
            throw new IllegalStateException("la chiave league.budget deve essere positiva, trovato: "
                    + rules.budget());
        }
        requireNonDecreasingBonuses("league.scoring.defence-modifier", scoring.defenceModifier());
        requireNonDecreasingBonuses("league.scoring.goalkeeper-modifier", scoring.goalkeeperModifier());
        if (!scoring.modifiersConfirmed() && !devProfile) {
            throw new IllegalStateException(
                    "la chiave league.scoring.modifiers-confirmed è false: sostituire le tabelle "
                    + "segnaposto dei modificatori con quelle reali della lega prima di usare "
                    + "l'applicazione in asta");
        }
        if (catalog.all().isEmpty() && !devProfile) {
            throw new IllegalStateException(
                    "catalogo vuoto: nessun file Quotazioni_*.xlsx trovato in " + dataDir
                    + " — atteso un listone come " + dataDir
                    + "/Quotazioni_Fantacalcio_Stagione_2026_27.xlsx prima di avviare l'applicazione in asta");
        }
    }

    /**
     * Il bonus di una tabella a gradini deve crescere (o restare uguale) al crescere
     * della soglia: l'argomento di convessità del motore — spendere per superare una
     * soglia vale di più quanto più alto è il gradino raggiunto — dipende da questo.
     */
    private static void requireNonDecreasingBonuses(String key, ModifierTable table) {
        List<ModifierTable.Threshold> thresholds = table.thresholds();
        for (int i = 1; i < thresholds.size(); i++) {
            if (thresholds.get(i).bonus() < thresholds.get(i - 1).bonus()) {
                throw new IllegalStateException(
                        "la tabella " + key + " non è monotona crescente: il bonus alla soglia "
                        + thresholds.get(i).minAverage() + " (" + thresholds.get(i).bonus()
                        + ") è minore di quello alla soglia precedente ("
                        + thresholds.get(i - 1).bonus() + ")");
            }
        }
    }
}
