package com.fantaagent.adapter.in.web;

import com.fantaagent.application.service.AuctionRuntime;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.AuctionSettingsHolder;
import com.fantaagent.config.AuctionSettingsStore;
import com.fantaagent.config.AuctionSettingsValidator;
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
 * Schermata delle impostazioni, in due modalita' decise da una sola condizione: se
 * un'asta e' gia' aperta o no.
 *
 * <p><b>PREPARAZIONE</b> — nessuna asta scelta. Si arriva qui dalla home avendo detto
 * "nuova asta". Tutto e' modificabile, compreso il nome da dare all'asta, e un solo
 * pulsante conferma l'intero blocco: regole, partecipanti e battitore insieme. E' quel
 * pulsante — non il click sulla home — a CREARE l'asta. Prima la cartella nasceva al
 * primo click, e chi tornava indietro lasciava dietro di se' un'asta vuota che restava
 * per sempre nell'elenco.
 *
 * <p><b>ASTA IN CORSO</b> — si arriva qui dalla schermata d'asta. Le regole di punteggio
 * sono in sola lettura: da esse discendono i punti attesi di ogni giocatore e quindi
 * ogni raccomandazione gia' data, e cambiarle a meta' asta renderebbe i prezzi gia'
 * pagati impossibili da interpretare — meta' decisi con un modello, meta' con un altro.
 * Nomi dei partecipanti e preferenze del battitore restano invece sempre modificabili:
 * non entrano in alcun calcolo, e il registro lega gli acquisti agli id, non ai nomi.
 *
 * <p>In entrambe le modalita' il salvataggio non aggiorna nulla a pezzi: chiede a
 * {@link AuctionRuntime} di ricostruire l'intera catena e di pubblicarla in blocco.
 */
@Controller
public class SettingsController {

    /** Oltre non e' piu' un nome ma un appunto, e non entra in nessuna intestazione. */
    private static final int MAX_NAME = 60;

    private final ScoringSettingsStore store;
    private final LeagueMembersSettingsStore membersStore;
    private final AuctionRuntime runtime;
    private final AuctionSettingsStore auctionStore;
    private final AuctionSettingsHolder auctionSettings;

    public SettingsController(ScoringSettingsStore store,
                              LeagueMembersSettingsStore membersStore, AuctionRuntime runtime,
                              AuctionSettingsStore auctionStore,
                              AuctionSettingsHolder auctionSettings) {
        this.store = store;
        this.membersStore = membersStore;
        this.runtime = runtime;
        this.auctionStore = auctionStore;
        this.auctionSettings = auctionSettings;
    }

    /** Nessuna asta aperta significa che la si sta preparando. */
    private boolean setup() {
        return !runtime.hasAuction();
    }

    private ScoringRules current() {
        return runtime.snapshot().chain().scoring();
    }

    private List<Participant> participants() {
        return runtime.snapshot().participants();
    }

    @GetMapping("/impostazioni")
    public String show(Model model) {
        populate(model);
        model.addAttribute("settings", currentSettings());
        model.addAttribute("members", participants());
        model.addAttribute("bidderSettings", auctionSettings.get());
        model.addAttribute("auctionName", "");
        return "settings";
    }

    /**
     * Un solo pulsante per l'intero blocco.
     *
     * <p>Gli errori delle tre sezioni si raccolgono e si mostrano insieme: con un solo
     * invio, riportarne uno per volta costringerebbe a tre giri per scoprire tre
     * problemi che erano visibili tutti dall'inizio.
     *
     * <p>Ad asta in corso i parametri di punteggio non vengono nemmeno letti. Non e'
     * ridondante rispetto ai campi disabilitati nel form: quelli impediscono di
     * modificarli dal browser, questo impedisce di modificarli, punto.
     */
    @PostMapping("/impostazioni")
    public String save(
            @RequestParam(name = "auctionName", defaultValue = "") String auctionName,
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
            @RequestParam(name = "id", required = false) List<String> ids,
            @RequestParam(name = "name", required = false) List<String> names,
            @RequestParam(name = "initial", required = false) List<String> initials,
            @RequestParam(name = "me", required = false) String ownerId,
            @RequestParam(defaultValue = "5") int bidTimerSeconds,
            @RequestParam(defaultValue = "false") boolean beepEnabled,
            Model model) {

        boolean preparing = setup();
        List<String> errors = new ArrayList<>();

        String name = auctionName == null ? "" : auctionName.trim();
        if (preparing) {
            if (name.isEmpty()) {
                errors.add("Dai un nome all'asta: serve a riconoscerla nell'elenco "
                        + "quando ne avrai piu' di una.");
            } else if (name.length() > MAX_NAME) {
                errors.add("Il nome dell'asta non puo' superare " + MAX_NAME + " caratteri.");
            }
        }

        ScoringSettings scoring = preparing
                ? parseScoring(defenceModifierEnabled, defendersCounted, minAverages, bonuses,
                        goalBonusP, goalBonusD, goalBonusC, goalBonusA, assist, penaltyScored,
                        penaltyMissed, penaltySaved, yellowCard, redCard, goalConceded,
                        cleanSheet, confirmed, errors)
                : currentSettings();
        if (preparing) {
            errors.addAll(ScoringSettingsValidator.validate(scoring));
        }

        List<Participant> members = parseMembers(ids, names, initials, ownerId);
        errors.addAll(LeagueMembersSettingsValidator.validate(members));

        AuctionSettings bidder = new AuctionSettings(bidTimerSeconds, beepEnabled);
        errors.addAll(AuctionSettingsValidator.validate(bidder));

        if (!errors.isEmpty()) {
            populate(model);
            model.addAttribute("errors", errors);
            model.addAttribute("settings", scoring);
            model.addAttribute("members", members.isEmpty() ? participants() : members);
            model.addAttribute("bidderSettings", bidder);
            model.addAttribute("auctionName", name);
            return "settings";
        }

        if (preparing) {
            store.save(scoring);
        }
        // La configurazione generale e' il MODELLO per la prossima asta, non i
        // partecipanti di quella aperta: quelli vivono nell'asta, e riconfigurarne una
        // nuova non deve piu' riscrivere i nomi mostrati per le precedenti.
        membersStore.save(members);
        if (!preparing) {
            runtime.setParticipants(members);
        }
        auctionStore.save(bidder);
        auctionSettings.set(bidder);
        // Ricostruzione atomica: la catena nuova viene costruita per intero e pubblicata
        // in un colpo solo, prima che l'asta la usi.
        runtime.rebuild();

        if (preparing) {
            runtime.createNew(name);
            return "redirect:/asta";
        }

        populate(model);
        model.addAttribute("settings", currentSettings());
        model.addAttribute("members", participants());
        model.addAttribute("bidderSettings", auctionSettings.get());
        model.addAttribute("auctionName", "");
        model.addAttribute("saved", true);
        return "settings";
    }

    private void populate(Model model) {
        model.addAttribute("setup", setup());
        model.addAttribute("file", store.file().toString());
        model.addAttribute("fileGoverns", store.exists());
        model.addAttribute("membersFile", membersStore.file().toString());
        model.addAttribute("membersFileGoverns", membersStore.exists());
        model.addAttribute("bidderFile", auctionStore.file().toString());
        model.addAttribute("bidderMinSeconds", AuctionSettingsValidator.MIN_SECONDS);
        model.addAttribute("bidderMaxSeconds", AuctionSettingsValidator.MAX_SECONDS);
        model.addAttribute("currentAuction", runtime.currentAuctionLabel());
    }

    private static List<Participant> parseMembers(List<String> ids, List<String> names,
                                                  List<String> initials, String ownerId) {
        List<Participant> members = new ArrayList<>();
        if (ids == null || names == null || initials == null) {
            return members;
        }
        int rows = Math.min(ids.size(), Math.min(names.size(), initials.size()));
        for (int i = 0; i < rows; i++) {
            String id = ids.get(i);
            String name = names.get(i) == null ? "" : names.get(i).trim();
            String initialRaw = initials.get(i) == null ? "" : initials.get(i).trim();
            char initial = initialRaw.isEmpty() ? ' ' : initialRaw.charAt(0);
            members.add(new Participant(id, name, initial, id.equals(ownerId)));
        }
        return members;
    }

    @SuppressWarnings("checkstyle:ParameterNumber")
    private static ScoringSettings parseScoring(
            boolean defenceModifierEnabled, int defendersCounted,
            List<String> minAverages, List<String> bonuses,
            String goalBonusP, String goalBonusD, String goalBonusC, String goalBonusA,
            String assist, String penaltyScored, String penaltyMissed, String penaltySaved,
            String yellowCard, String redCard, String goalConceded, String cleanSheet,
            boolean confirmed, List<String> errors) {
        List<ScoringSettings.Step> steps = parseSteps(minAverages, bonuses, errors);
        Map<Role, Double> goalBonus = new EnumMap<>(Role.class);
        goalBonus.put(Role.P, parse(goalBonusP, "bonus gol portiere", errors));
        goalBonus.put(Role.D, parse(goalBonusD, "bonus gol difensore", errors));
        goalBonus.put(Role.C, parse(goalBonusC, "bonus gol centrocampista", errors));
        goalBonus.put(Role.A, parse(goalBonusA, "bonus gol attaccante", errors));
        return new ScoringSettings(
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
