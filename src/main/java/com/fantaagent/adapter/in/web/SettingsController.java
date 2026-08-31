package com.fantaagent.adapter.in.web;

import com.fantaagent.application.service.AuctionService;
import com.fantaagent.config.ScoringSettings;
import com.fantaagent.config.ScoringSettingsStore;
import com.fantaagent.config.ScoringSettingsValidator;
import com.fantaagent.domain.league.ScoringRules;
import com.fantaagent.domain.player.Role;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Schermata delle impostazioni di lega.
 *
 * <p>Due vincoli governano questa pagina.
 *
 * <p>Il primo: le regole di punteggio si possono cambiare solo prima del primo acquisto.
 * Il registro dell'asta resterebbe valido, ma ogni raccomandazione già data smetterebbe
 * di essere riproducibile, e la riproducibilità di questa applicazione si fonda proprio
 * sul fatto che il motore è deterministico.
 *
 * <p>Il secondo: il salvataggio scrive su disco e le nuove regole valgono dal riavvio.
 * Da esse discendono i punti attesi di tutti i giocatori, i livelli di rimpiazzo e il
 * motore: aggiornarle senza ricostruire quella catena mostrerebbe numeri vecchi con
 * un'etichetta nuova. Meglio due secondi di riavvio che un numero plausibile e falso.
 */
@Controller
public class SettingsController {

    private final ScoringSettingsStore store;
    private final ScoringRules current;
    private final AuctionService auction;

    public SettingsController(ScoringSettingsStore store, ScoringRules current,
                              AuctionService auction) {
        this.store = store;
        this.current = current;
        this.auction = auction;
    }

    @GetMapping("/impostazioni")
    public String show(Model model) {
        model.addAttribute("settings", currentSettings());
        model.addAttribute("locked", auctionStarted());
        model.addAttribute("file", store.file().toString());
        return "settings";
    }

    @PostMapping("/impostazioni")
    public String save(
            @RequestParam(defaultValue = "false") boolean defenceModifierEnabled,
            @RequestParam(defaultValue = "3") int defendersCounted,
            @RequestParam(name = "minAverage", required = false) List<String> minAverages,
            @RequestParam(name = "bonus", required = false) List<String> bonuses,
            @RequestParam(name = "goalBonusP", defaultValue = "0") String goalBonusP,
            @RequestParam(name = "goalBonusD", defaultValue = "0") String goalBonusD,
            @RequestParam(name = "goalBonusC", defaultValue = "0") String goalBonusC,
            @RequestParam(name = "goalBonusA", defaultValue = "0") String goalBonusA,
            @RequestParam(defaultValue = "0") String assist,
            @RequestParam(defaultValue = "0") String penaltyScored,
            @RequestParam(defaultValue = "0") String penaltyMissed,
            @RequestParam(defaultValue = "0") String penaltySaved,
            @RequestParam(defaultValue = "0") String yellowCard,
            @RequestParam(defaultValue = "0") String redCard,
            @RequestParam(defaultValue = "0") String goalConceded,
            @RequestParam(defaultValue = "0") String cleanSheet,
            @RequestParam(defaultValue = "false") boolean confirmed,
            Model model) {

        model.addAttribute("file", store.file().toString());
        model.addAttribute("locked", auctionStarted());

        if (auctionStarted()) {
            model.addAttribute("settings", currentSettings());
            model.addAttribute("errors", List.of(
                    "L'asta è già iniziata: le regole di punteggio non si possono più "
                    + "cambiare, altrimenti le raccomandazioni già date smetterebbero di "
                    + "essere ricostruibili. Annulla gli acquisti registrati se hai "
                    + "davvero bisogno di correggerle."));
            return "settings";
        }

        List<String> errors = new ArrayList<>();
        List<ScoringSettings.Step> steps = parseSteps(minAverages, bonuses, errors);
        Map<Role, Double> goalBonus = new EnumMap<>(Role.class);
        goalBonus.put(Role.P, parse(goalBonusP, "bonus gol portiere", errors));
        goalBonus.put(Role.D, parse(goalBonusD, "bonus gol difensore", errors));
        goalBonus.put(Role.C, parse(goalBonusC, "bonus gol centrocampista", errors));
        goalBonus.put(Role.A, parse(goalBonusA, "bonus gol attaccante", errors));

        ScoringSettings candidate = new ScoringSettings(
                defenceModifierEnabled, defendersCounted, steps, goalBonus,
                parse(assist, "assist", errors),
                parse(penaltyScored, "rigore segnato", errors),
                parse(penaltyMissed, "rigore sbagliato", errors),
                parse(penaltySaved, "rigore parato", errors),
                parse(yellowCard, "ammonizione", errors),
                parse(redCard, "espulsione", errors),
                parse(goalConceded, "gol subito", errors),
                parse(cleanSheet, "porta inviolata", errors),
                confirmed);

        errors.addAll(ScoringSettingsValidator.validate(candidate));

        model.addAttribute("settings", candidate);
        if (!errors.isEmpty()) {
            model.addAttribute("errors", errors);
            return "settings";
        }

        store.save(candidate);
        model.addAttribute("saved", true);
        return "settings";
    }

    private boolean auctionStarted() {
        return !auction.state().holdings().isEmpty();
    }

    private ScoringSettings currentSettings() {
        return store.load().orElseGet(() -> ScoringSettings.from(current, isDefenceActive()));
    }

    /**
     * Una tabella con un solo gradino a bonus zero è la forma neutra che questo progetto
     * usa per "modificatore spento": riconoscerla evita di mostrare la casella spuntata
     * quando in realtà il modificatore non fa nulla.
     */
    private boolean isDefenceActive() {
        var thresholds = current.defenceModifier().thresholds();
        return thresholds.stream().anyMatch(t -> t.bonus() != 0.0);
    }

    private static List<ScoringSettings.Step> parseSteps(
            List<String> minAverages, List<String> bonuses, List<String> errors) {
        List<ScoringSettings.Step> steps = new ArrayList<>();
        if (minAverages == null || bonuses == null) {
            return steps;
        }
        int rows = Math.min(minAverages.size(), bonuses.size());
        for (int i = 0; i < rows; i++) {
            String a = minAverages.get(i);
            String b = bonuses.get(i);
            if (a == null || a.isBlank()) {
                continue;   // riga lasciata vuota nel form: non è un errore, si ignora
            }
            steps.add(new ScoringSettings.Step(
                    parse(a, "media riga " + (i + 1), errors),
                    parse(b, "bonus riga " + (i + 1), errors)));
        }
        return steps;
    }

    /** Accetta sia la virgola sia il punto: si digita "6,25" molto più spesso di "6.25". */
    private static double parse(String raw, String label, List<String> errors) {
        try {
            return Double.parseDouble(raw.trim().replace(',', '.'));
        } catch (NumberFormatException | NullPointerException e) {
            errors.add("«" + label + "»: «" + raw + "» non è un numero.");
            return 0.0;
        }
    }
}
