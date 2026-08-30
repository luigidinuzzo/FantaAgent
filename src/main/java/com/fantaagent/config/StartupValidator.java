package com.fantaagent.config;

import com.fantaagent.domain.league.LeagueRules;
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

    public StartupValidator(LeagueRules rules, ScoringRules scoring,
                            List<Participant> participants,
                            @Value("${fantaagent.dev-profile:false}") boolean devProfile) {
        this.rules = rules;
        this.scoring = scoring;
        this.participants = participants;
        this.devProfile = devProfile;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void validateOnStartup() {
        validate();
    }

    public void validate() {
        if (participants.size() != rules.participants()) {
            throw new IllegalStateException(
                    "configured participants (" + participants.size()
                    + ") do not match league.participants (" + rules.participants() + ")");
        }
        Set<Character> initials = new HashSet<>();
        for (Participant p : participants) {
            if (!initials.add(p.initial())) {
                throw new IllegalStateException(
                        "duplicate participant initial '" + p.initial() + "'");
            }
        }
        long owners = participants.stream().filter(Participant::me).count();
        if (owners != 1) {
            throw new IllegalStateException(
                    "exactly one participant must have me=true, found " + owners);
        }
        if (rules.rosterSize() < 1) {
            throw new IllegalStateException("roster size must be positive");
        }
        if (!scoring.modifiersConfirmed() && !devProfile) {
            throw new IllegalStateException(
                    "league.scoring.modifiers-confirmed is false: sostituire le tabelle "
                    + "segnaposto dei modificatori prima di usare l'applicazione in asta");
        }
    }
}
