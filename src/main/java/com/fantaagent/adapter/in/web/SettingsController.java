package com.fantaagent.adapter.in.web;

import com.fantaagent.application.service.AuctionRuntime;
import com.fantaagent.application.service.AuctionService;
import com.fantaagent.config.LeagueMembersSettingsStore;
import com.fantaagent.config.LeagueMembersSettingsValidator;
import com.fantaagent.config.ScoringSettings;
import com.fantaagent.config.ScoringSettingsStore;
import com.fantaagent.config.ScoringSettingsValidator;
import com.fantaagent.domain.league.Participant;
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
 * <p>Due parti, due regimi diversi, decisi con l'utente.
 *
 * <p><b>Nomi e iniziali dei partecipanti: sempre modificabili, effetto immediato.</b>
 * Gli id restano fissi ed è agli id che il registro lega gli acquisti, quindi cambia
 * solo ciò che si legge a schermo: il significato di quanto già registrato non si
 * muove. Le iniziali devono restare uniche perché la barra comando risolve
 * l'acquirente proprio dall'iniziale, e uno e un solo partecipante resta marcato come
 * "tu".
 *
 * <p><b>Regole di punteggio: modificabili a effetto immediato finché non c'è nessun
 * acquisto, bloccate dal primo in poi.</b> I prezzi già pagati sono stati decisi sotto
 * le vecchie regole: mescolare due modelli di punteggio dentro la stessa asta rende la
 * rosa risultante impossibile da interpretare — metà dei numeri direbbe una cosa e metà
 * un'altra, senza che si veda quale.
 *
 * <p>In entrambi i casi il salvataggio non aggiorna nulla a pezzi: chiede a
 * {@link com.fantaagent.application.service.AuctionRuntime} di ricostruire l'intera
 * catena (proiezioni, livelli di rimpiazzo, modificatori, completamento, motore) e di
 * pubblicarla in blocco. Nessun riavvio, e nessun istante in cui metà dei numeri viene
 * da un modello e metà dall'altro.
 */
@Controller
public class SettingsController {

    private final ScoringSettingsStore store;
    private final AuctionService auction;
    private final LeagueMembersSettingsStore membersStore;
    private final AuctionRuntime runtime;

    public SettingsController(ScoringSettingsStore store, AuctionService auction,
                              LeagueMembersSettingsStore membersStore, AuctionRuntime runtime) {
        this.store = store;
        this.auction = auction;
        this.membersStore = membersStore;
        this.runtime = runtime;
    }

    /** Le regole in vigore adesso, non quelle lette all'avvio. */
    private ScoringRules current() {
        return runtime.snapshot().chain().scoring();
    }

    /** I partecipanti in vigore adesso, non quelli letti all'avvio. */
    private List<Participant> participants() {
        return runtime.snapshot().participants();
    }

    @GetMapping("/impostazioni")
    public String show(Model model) {
        model.addAttribute("settings", currentSettings());
        model.addAttribute("locked", auctionStarted());
        model.addAttribute("file", store.file().toString());
        model.addAttribute("fileGoverns", store.exists());
        populateMembersShell(model);
        model.addAttribute("members", participants());
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
        model.addAttribute("fileGoverns", store.exists());
        populateMembersShell(model);
        model.addAttribute("members", participants());

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
        // Ricostruzione atomica: la nuova catena viene costruita per intero e poi
        // pubblicata in un colpo solo. Da qui in avanti ogni numero mostrato viene dal
        // nuovo modello, nessuno dal vecchio.
        runtime.rebuild();
        model.addAttribute("settings", currentSettings());
        model.addAttribute("fileGoverns", store.exists());
        model.addAttribute("saved", true);
        return "settings";
    }

    /**
     * Rinomina i partecipanti senza toccare i loro id: sono gli id, non i nomi, a cui
     * il registro dell'asta lega gli acquisti già fatti. Proprio per questo la modifica
     * resta permessa anche ad asta iniziata — cambia solo ciò che si legge a schermo —
     * e ha effetto subito, senza riavvio.
     */
    @PostMapping("/impostazioni/partecipanti")
    public String saveParticipants(
            @RequestParam(name = "id") List<String> ids,
            @RequestParam(name = "name") List<String> names,
            @RequestParam(name = "initial") List<String> initials,
            @RequestParam(name = "me", required = false) String ownerId,
            Model model) {

        model.addAttribute("settings", currentSettings());
        model.addAttribute("locked", auctionStarted());
        model.addAttribute("file", store.file().toString());
        model.addAttribute("fileGoverns", store.exists());
        populateMembersShell(model);

        List<Participant> candidate = new ArrayList<>();
        int rows = Math.min(ids.size(), Math.min(names.size(), initials.size()));
        for (int i = 0; i < rows; i++) {
            String id = ids.get(i);
            String name = names.get(i) == null ? "" : names.get(i).trim();
            String initialRaw = initials.get(i) == null ? "" : initials.get(i).trim();
            char initial = initialRaw.isEmpty() ? ' ' : initialRaw.charAt(0);
            candidate.add(new Participant(id, name, initial, id.equals(ownerId)));
        }

        List<String> errors = LeagueMembersSettingsValidator.validate(candidate);
        model.addAttribute("members", candidate);
        if (!errors.isEmpty()) {
            model.addAttribute("membersErrors", errors);
            return "settings";
        }

        membersStore.save(candidate);
        runtime.rebuild();
        model.addAttribute("members", participants());
        model.addAttribute("membersFileGoverns", true);
        model.addAttribute("membersSaved", true);
        return "settings";
    }

    private void populateMembersShell(Model model) {
        model.addAttribute("membersFile", membersStore.file().toString());
        model.addAttribute("membersFileGoverns", membersStore.exists());
    }

    private boolean auctionStarted() {
        return !auction.state().holdings().isEmpty();
    }

    private ScoringSettings currentSettings() {
        return store.load().orElseGet(() -> ScoringSettings.from(current(), isDefenceActive()));
    }

    /**
     * Una tabella con un solo gradino a bonus zero è la forma neutra che questo progetto
     * usa per "modificatore spento": riconoscerla evita di mostrare la casella spuntata
     * quando in realtà il modificatore non fa nulla.
     */
    private boolean isDefenceActive() {
        var thresholds = current().defenceModifier().thresholds();
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
