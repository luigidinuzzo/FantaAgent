package com.fantaagent.config;

import com.fantaagent.domain.league.Participant;

import java.util.ArrayList;
import java.util.Collections;
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

    /**
     * Gli errori con accanto il campo che li ha causati.
     *
     * <p>Il metodo storico {@link #validate} resta e delega a questo: la sua firma serve
     * ancora alla pagina Thymeleaf sotto {@code /legacy}, che mostra le frasi cosi'
     * come sono. Una logica, due consumatori.
     *
     * <p>Le chiavi si inseriscono nell'ordine in cui i controlli girano, perche'
     * l'appiattimento deve riprodurre l'ordine dei messaggi di prima — e' cio' che i
     * test di SettingsController verificano senza saperlo. La mappa restituita e' una
     * {@link LinkedHashMap} non modificabile apposta: {@code Map.copyOf} non garantisce
     * l'ordine di inserimento, e qui l'ordine e' parte del contratto.
     *
     * <p>L'iniziale duplicata e chi e' segnato come «tu» sono errori dell'INSIEME —
     * chiave {@code "participants"} — non di una riga: riguardano piu' di un
     * partecipante, e attribuirli a uno solo manderebbe a correggere quello sbagliato.
     * Il nome vuoto e l'iniziale mancante riguardano invece una riga precisa, sotto
     * {@code "participants[<id>].name"} / {@code "participants[<id>].initial"}.
     *
     * @return mappa vuota se i partecipanti sono validi
     */
    public static Map<String, List<String>> validateByField(List<Participant> members) {
        Map<String, List<String>> errors = new LinkedHashMap<>();

        if (members.isEmpty()) {
            add(errors, "participants", "Serve almeno un partecipante.");
            return Collections.unmodifiableMap(errors);
        }

        for (Participant p : members) {
            if (p.name() == null || p.name().isBlank()) {
                add(errors, "participants[" + p.id() + "].name",
                        "Il partecipante con id «" + p.id() + "» non può avere un nome vuoto.");
            }
            if (Character.isWhitespace(p.initial())) {
                add(errors, "participants[" + p.id() + "].initial",
                        "Il partecipante «" + p.name() + "» non ha un'iniziale.");
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
                add(errors, "participants", "L'iniziale «" + initial + "» è usata da più "
                        + "partecipanti (" + String.join(", ", names) + "): deve essere unica "
                        + "perché il comando «giocatore prezzo iniziale» la usa per riconoscere "
                        + "l'acquirente.");
            }
        });

        long owners = members.stream().filter(Participant::me).count();
        if (owners == 0) {
            add(errors, "participants",
                    "Nessun partecipante è segnato come «tu»: deve essercene esattamente uno.");
        } else if (owners > 1) {
            add(errors, "participants", "Più di un partecipante è segnato come «tu» (" + owners
                    + "): deve essercene esattamente uno.");
        }

        return Collections.unmodifiableMap(errors);
    }

    /** @return elenco vuoto se i partecipanti sono validi */
    public static List<String> validate(List<Participant> members) {
        return validateByField(members).values().stream().flatMap(List::stream).toList();
    }

    private static void add(Map<String, List<String>> errors, String key, String message) {
        errors.computeIfAbsent(key, k -> new ArrayList<>()).add(message);
    }
}
