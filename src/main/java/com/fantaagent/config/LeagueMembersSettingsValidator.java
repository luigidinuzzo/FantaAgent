package com.fantaagent.config;

import com.fantaagent.domain.league.Participant;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Validazione dei partecipanti della lega, come funzione pura — stesso pattern di
 * {@link ScoringSettingsValidator}: la stessa logica serve il salvataggio dalla UI e il
 * controllo all'avvio.
 *
 * <p>Due vincoli sono strutturali, non solo di buon gusto: le iniziali devono restare
 * uniche perché la grammatica dei comandi (es. {@code bast 47 m}) le usa per risolvere
 * l'acquirente, ed esattamente un partecipante deve restare segnato come proprietario
 * ({@code me}), perché è quello a cui l'interfaccia riferisce come "tu".
 */
public final class LeagueMembersSettingsValidator {

    private LeagueMembersSettingsValidator() {
    }

    /** @return elenco vuoto se i partecipanti sono validi */
    public static List<String> validate(List<Participant> members) {
        List<String> errors = new ArrayList<>();

        if (members.isEmpty()) {
            errors.add("Serve almeno un partecipante.");
            return List.copyOf(errors);
        }

        for (Participant p : members) {
            if (p.name() == null || p.name().isBlank()) {
                errors.add("Il partecipante con id «" + p.id() + "» non può avere un nome vuoto.");
            }
            if (Character.isWhitespace(p.initial())) {
                errors.add("Il partecipante «" + p.name() + "» non ha un'iniziale.");
            }
        }

        Map<Character, List<String>> byInitial = new LinkedHashMap<>();
        for (Participant p : members) {
            if (!Character.isWhitespace(p.initial())) {
                byInitial.computeIfAbsent(p.initial(), k -> new ArrayList<>()).add(p.name());
            }
        }
        byInitial.forEach((initial, names) -> {
            if (names.size() > 1) {
                errors.add("L'iniziale «" + initial + "» è usata da più partecipanti ("
                        + String.join(", ", names) + "): deve essere unica perché il comando "
                        + "«giocatore prezzo iniziale» la usa per riconoscere l'acquirente.");
            }
        });

        long owners = members.stream().filter(Participant::me).count();
        if (owners == 0) {
            errors.add("Nessun partecipante è segnato come «tu»: deve essercene esattamente uno.");
        } else if (owners > 1) {
            errors.add("Più di un partecipante è segnato come «tu» (" + owners
                    + "): deve essercene esattamente uno.");
        }

        return List.copyOf(errors);
    }
}
