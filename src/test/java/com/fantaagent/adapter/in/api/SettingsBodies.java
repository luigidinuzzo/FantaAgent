package com.fantaagent.adapter.in.api;

/**
 * Il corpo JSON minimo valido, condiviso da {@link SettingsApiTest} e
 * {@link SettingsApiCreationTest}.
 *
 * <p>Un partecipante solo, segnato come "tu": e' la forma piu' piccola che i tre
 * validatori accettano tutti insieme. Estratto qui perche' due copie dello stesso
 * corpo divergerebbero al primo campo che qualcuno aggiunge in un file e si scorda
 * nell'altro.
 */
final class SettingsBodies {

    private SettingsBodies() {
    }

    static String valid(String auctionName, int timer) {
        return """
               {
                 "auctionName": "%s",
                 "bidder": { "bidTimerSeconds": %d, "beepEnabled": true },
                 "participants": [
                   { "id": "anna", "name": "Anna", "initial": "A", "me": true }
                 ],
                 "scoring": {
                   "defenceModifierEnabled": false,
                   "defendersCounted": 3,
                   "thresholds": [ { "minAverage": 0, "bonus": 0 } ],
                   "goalBonus": { "P": 0, "D": 0, "C": 0, "A": 0 },
                   "assist": 1, "penaltyScored": 3, "penaltyMissed": -3,
                   "penaltySaved": 3, "yellowCard": -0.5, "redCard": -1,
                   "goalConceded": -1, "cleanSheet": 1, "confirmed": true
                 }
               }
               """.formatted(auctionName, timer);
    }
}
