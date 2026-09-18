package com.fantaagent.adapter.in.api;

import com.fantaagent.adapter.in.api.dto.SettingsDtos;
import com.fantaagent.application.service.AuctionRuntime;
import com.fantaagent.application.service.AuctionSetup;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.AuctionSettingsValidator;
import com.fantaagent.config.LeagueMembersSettingsValidator;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.config.LeagueRulesValidator;
import com.fantaagent.config.ParticipantInitials;
import com.fantaagent.config.ScoringSettings;
import com.fantaagent.config.ScoringSettingsValidator;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Role;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Lettura e scrittura delle impostazioni, e la nascita di un'asta.
 *
 * <p><b>Tutto e' dell'asta.</b> Si legge dallo snapshot del runtime — l'asta aperta, o
 * il modello quando non ce n'e' una — e si scrive solo nella cartella dell'asta: in
 * preparazione nasce con {@link AuctionRuntime#createNew(AuctionSetup)}, gia' validata
 * per intero; ad asta aperta cambiano solo nomi e preferenze del battitore. Nessun file
 * globale viene riscritto da qui: quelli sono il modello della prossima asta.
 *
 * <p><b>Ad asta aperta i parametri di punteggio non vengono nemmeno letti.</b> Non e'
 * ridondante rispetto ai campi disabilitati nell'interfaccia: quelli impediscono di
 * modificarli dal browser, questo impedisce di modificarli, punto. Cambiarli a rosa
 * comprata riscriverebbe i numeri con cui quella rosa e' stata pagata. Lo stesso vale
 * per crediti, slot e numero di partecipanti.
 */
@RestController
@RequestMapping("/api/leagues/{leagueId}/settings")
public class SettingsApi {

    /**
     * Lo stesso NUMERO di {@code SettingsController#MAX_NAME}, non la stessa costante:
     * ognuna e' dichiarata per conto suo, e i due messaggi d'errore sono duplicati a
     * mano nei due file. {@code SettingsController} non e' sparito con la tappa 6
     * come previsto (task 16): resta sotto {@code /legacy}, e con lui questa
     * duplicazione.
     */
    static final int MAX_NAME = 60;

    private final LeagueGuard leagues;
    private final AuctionRuntime runtime;

    public SettingsApi(LeagueGuard leagues, AuctionRuntime runtime) {
        this.leagues = leagues;
        this.runtime = runtime;
    }

    @GetMapping
    public SettingsDtos.SettingsResponse read(@PathVariable String leagueId) {
        leagues.check(leagueId);
        AuctionSettings bidder = runtime.bidder();
        return new SettingsDtos.SettingsResponse(
                new SettingsDtos.BidderSettings(bidder.bidTimerSeconds(), bidder.beepEnabled()),
                runtime.participants().stream().map(SettingsApi::cardOf).toList(),
                sectionOf(runtime.scoringSettings()),
                runtime.hasAuction(),
                SettingsDtos.LeagueRulesView.from(runtime.rules()));
    }

    @PutMapping
    public SettingsDtos.SaveResult save(@PathVariable String leagueId,
                                        @RequestBody SettingsDtos.SaveRequest body) {
        leagues.check(leagueId);
        boolean preparing = !runtime.hasAuction();

        // Chiavi di campo, non di sezione (task 16): ognuna presente solo se ha
        // davvero un errore, perche' un id di partecipante o un indice di riga non si
        // possono elencare tutti in anticipo come le quattro sezioni di prima.
        Map<String, List<String>> errors = new LinkedHashMap<>();

        String name = body.auctionName() == null ? "" : body.auctionName().trim();
        if (preparing) {
            if (name.isEmpty()) {
                addError(errors, "auctionName", "Dai un nome all'asta: serve a riconoscerla "
                        + "nell'elenco quando ne avrai piu' di una.");
            } else if (name.length() > MAX_NAME) {
                addError(errors, "auctionName", "Il nome dell'asta non puo' superare "
                        + MAX_NAME + " caratteri.");
            }
        }

        // Ad asta aperta il punteggio del corpo non si legge nemmeno: i parametri non si
        // toccano, e questo campo resta null e inutilizzato fino alla fine del metodo.
        ScoringSettings scoring = null;
        if (preparing) {
            // Una chiave "scoring" assente (corpo malformato, non un modulo compilato
            // male) e' un errore del CHIAMANTE: deve cadere nel 422 tipizzato qui sotto,
            // non nella NullPointerException che settingsOf() solleverebbe leggendo un
            // record null, che il ramo generico avrebbe riportato come "internal-error".
            // La chiave resta "scoring", grezza: non e' uno dei campi che
            // ScoringSettingsValidator conosce, e' l'intera sezione che manca.
            if (body.scoring() == null) {
                addError(errors, "scoring", "Le impostazioni del punteggio sono obbligatorie.");
            } else {
                scoring = settingsOf(body.scoring());
                mergeErrors(errors, ScoringSettingsValidator.validateByField(scoring));
            }
        }

        List<Participant> members = new ArrayList<>();
        for (SettingsDtos.ParticipantSettings p : orEmpty(body.participants())) {
            // Il costruttore di Participant rifiuta un id vuoto: costruirlo comunque
            // trasformerebbe un errore di compilazione del modulo in un 422 generico
            // senza dire quale riga. La chiave resta "participants": senza un id non
            // c'e' una riga precisa a cui puntare.
            if (p.id() == null || p.id().isBlank()) {
                addError(errors, "participants", "Ogni partecipante deve avere un identificativo.");
                continue;
            }
            members.add(new Participant(p.id(), p.name(), initialOf(p.initial()), p.me()));
        }
        // L'iniziale non arriva piu' dal modulo: la calcola il server dal nome (vedi
        // ParticipantInitials). Serve solo al comando di /legacy, ma deve restare unica.
        members = ParticipantInitials.assign(members);
        mergeErrors(errors, LeagueMembersSettingsValidator.validateByField(members));

        // Stessa storia del "scoring" qui sopra: una chiave "bidder" assente e' un
        // corpo malformato, non un modulo compilato male, e deve cadere nello stesso
        // 422 tipizzato invece che nella NullPointerException su
        // body.bidder().bidTimerSeconds() che il ramo generico avrebbe riportato come
        // "internal-error". La chiave resta "bidder", grezza: manca l'intero oggetto,
        // non solo il campo "bidTimerSeconds" che AuctionSettingsValidator conosce.
        AuctionSettings bidder = null;
        if (body.bidder() == null) {
            addError(errors, "bidder", "Le preferenze del battitore sono obbligatorie.");
        } else {
            bidder = new AuctionSettings(body.bidder().bidTimerSeconds(), body.bidder().beepEnabled());
            mergeErrors(errors, AuctionSettingsValidator.validateByField(bidder));
        }

        LeagueRulesSettings rules = null;
        if (preparing) {
            if (body.rules() == null) {
                addError(errors, "rules", "Le regole della lega sono obbligatorie.");
            } else {
                rules = new LeagueRulesSettings(body.rules().budget(), rolesOf(body.rules().slots()));
                mergeErrors(errors, LeagueRulesValidator.validateByField(rules, members.size()));
            }
        } else if (!sameIds(members, runtime.participants())) {
            // Il numero di squadre e' il numero di partecipanti: aggiungerne o toglierne
            // uno a meta' serata ricalcolerebbe budget e rose gia' pagate. L'interfaccia
            // non lo offre; il server non si fida.
            addError(errors, "participants",
                    "Ad asta aperta non si aggiungono né si tolgono partecipanti.");
        }

        if (!errors.isEmpty()) {
            throw new InvalidSettingsException(errors);
        }

        if (preparing) {
            return new SettingsDtos.SaveResult(runtime.createNew(
                    new AuctionSetup(name, rules, members, scoring, bidder)));
        }
        runtime.setParticipants(members);
        runtime.setBidder(bidder);
        return new SettingsDtos.SaveResult(null);
    }

    /** Una mappa assente o con un ruolo mancante diventa un ruolo a zero, che il validatore nomina. */
    private static Map<Role, Integer> rolesOf(Map<Role, Integer> slots) {
        Map<Role, Integer> out = new EnumMap<>(Role.class);
        for (Role role : Role.values()) {
            out.put(role, slots == null ? 0 : slots.getOrDefault(role, 0));
        }
        return out;
    }

    private static boolean sameIds(List<Participant> a, List<Participant> b) {
        return a.size() == b.size()
                && a.stream().map(Participant::id).collect(Collectors.toSet())
                        .equals(b.stream().map(Participant::id).collect(Collectors.toSet()));
    }

    private static <T> List<T> orEmpty(List<T> list) {
        return list == null ? List.of() : list;
    }

    private static void addError(Map<String, List<String>> errors, String key, String message) {
        errors.computeIfAbsent(key, k -> new ArrayList<>()).add(message);
    }

    /** Unisce la mappa per-campo di un validatore in quella di risposta, chiave per chiave. */
    private static void mergeErrors(Map<String, List<String>> errors, Map<String, List<String>> more) {
        more.forEach((key, messages) -> errors.computeIfAbsent(key, k -> new ArrayList<>()).addAll(messages));
    }

    /** Uno spazio quando manca: e' il valore su cui il validatore dice "non ha iniziale". */
    private static char initialOf(String initial) {
        return initial == null || initial.isBlank() ? ' ' : initial.charAt(0);
    }

    private static SettingsDtos.ParticipantSettings cardOf(Participant p) {
        return new SettingsDtos.ParticipantSettings(p.id(), p.name(),
                String.valueOf(p.initial()), p.me());
    }

    private static SettingsDtos.ScoringSection sectionOf(ScoringSettings s) {
        return new SettingsDtos.ScoringSection(s.defenceModifierEnabled(), s.defendersCounted(),
                s.thresholds().stream()
                        .map(t -> new SettingsDtos.ScoringStep(t.minAverage(), t.bonus()))
                        .toList(),
                s.goalBonus(), s.assist(), s.penaltyScored(), s.penaltyMissed(),
                s.penaltySaved(), s.yellowCard(), s.redCard(), s.goalConceded(),
                s.cleanSheet(), s.confirmed());
    }

    private static ScoringSettings settingsOf(SettingsDtos.ScoringSection s) {
        return new ScoringSettings(s.defenceModifierEnabled(), s.defendersCounted(),
                s.thresholds().stream()
                        .map(t -> new ScoringSettings.Step(t.minAverage(), t.bonus()))
                        .toList(),
                s.goalBonus(), s.assist(), s.penaltyScored(), s.penaltyMissed(),
                s.penaltySaved(), s.yellowCard(), s.redCard(), s.goalConceded(),
                s.cleanSheet(), s.confirmed());
    }
}
