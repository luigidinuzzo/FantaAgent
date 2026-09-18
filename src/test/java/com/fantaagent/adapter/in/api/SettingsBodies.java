package com.fantaagent.adapter.in.api;

import com.fantaagent.domain.league.Participant;

import java.util.List;
import java.util.Map;

/**
 * Il corpo JSON minimo valido, condiviso da {@link SettingsApiTest} e
 * {@link SettingsApiCreationTest}.
 *
 * <p>Due partecipanti, uno segnato come "tu", e le regole della lega: e' la forma piu'
 * piccola che i quattro validatori accettano tutti insieme (le regole chiedono
 * almeno due squadre). Estratto qui perche' due copie dello stesso
 * corpo divergerebbero al primo campo che qualcuno aggiunge in un file e si scorda
 * nell'altro.
 */
final class SettingsBodies {

    private SettingsBodies() {
    }

    /** Due partecipanti, coerenti con {@link #valid}: le regole ne chiedono almeno due. */
    static final List<Participant> PARTICIPANTS = List.of(
            new Participant("anna", "Anna", 'A', true),
            new Participant("bruno", "Bruno", 'B', false));

    static final Map<String, Integer> DEFAULT_SLOTS = Map.of("P", 3, "D", 8, "C", 8, "A", 6);

    static String valid(String auctionName, int timer) {
        return body(auctionName, timer, rules(500, DEFAULT_SLOTS));
    }

    static String valid(String auctionName, int budget, Map<String, Integer> slots) {
        return body(auctionName, 5, rules(budget, slots));
    }

    /** Due partecipanti senza iniziale, come li manda il modulo di «Crea asta». */
    static String withoutInitials(String auctionName) {
        return body(auctionName, 5, rules(500, DEFAULT_SLOTS))
                .replace("\"initial\": \"A\", ", "")
                .replace("\"initial\": \"B\", ", "")
                .replace("\"name\": \"Anna\"", "\"name\": \"Team 1\"")
                .replace("\"name\": \"Bruno\"", "\"name\": \"Team 2\"");
    }

    static String withoutRules(String auctionName) {
        return body(auctionName, 5, null);
    }

    private static String rules(int budget, Map<String, Integer> slots) {
        return """
               { "budget": %d, "slots": { "P": %d, "D": %d, "C": %d, "A": %d } }"""
                .formatted(budget, slots.get("P"), slots.get("D"), slots.get("C"), slots.get("A"));
    }

    private static String body(String auctionName, int timer, String rules) {
        return """
               {
                 "auctionName": "%s",
                 "bidder": { "bidTimerSeconds": %d, "beepEnabled": true },
                 "participants": [
                   { "id": "anna", "name": "Anna", "initial": "A", "me": true },
                   { "id": "bruno", "name": "Bruno", "initial": "B", "me": false }
                 ],
                 "scoring": {
                   "defenceModifierEnabled": false,
                   "defendersCounted": 3,
                   "thresholds": [ { "minAverage": 0, "bonus": 0 } ],
                   "goalBonus": { "P": 0, "D": 0, "C": 0, "A": 0 },
                   "assist": 1, "penaltyScored": 3, "penaltyMissed": -3,
                   "penaltySaved": 3, "yellowCard": -0.5, "redCard": -1,
                   "goalConceded": -1, "cleanSheet": 1, "confirmed": true
                 }%s
               }
               """.formatted(auctionName, timer, rules == null ? "" : ",\n  \"rules\": " + rules);
    }
}
