package com.fantaagent.adapter.in.api;

import com.fantaagent.adapter.in.api.dto.SettingsDtos;
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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Lettura e scrittura delle impostazioni, e la nascita di un'asta.
 *
 * <p>L'ordine delle scritture non e' un dettaglio, ed e' lo stesso che
 * {@code SettingsController} segue: i punteggi prima (solo in preparazione), poi i
 * partecipanti nella configurazione generale, poi nell'asta aperta se c'e', poi le
 * preferenze del battitore, poi {@link AuctionRuntime#rebuild()} che pubblica la catena
 * nuova in blocco, e solo alla fine la creazione dell'asta. Ricostruire dopo aver
 * creato significherebbe far nascere un'asta con la catena vecchia.
 *
 * <p><b>Ad asta aperta i parametri di punteggio non vengono nemmeno letti.</b> Non e'
 * ridondante rispetto ai campi disabilitati nell'interfaccia: quelli impediscono di
 * modificarli dal browser, questo impedisce di modificarli, punto. Cambiarli a rosa
 * comprata riscriverebbe i numeri con cui quella rosa e' stata pagata.
 */
@RestController
@RequestMapping("/api/leagues/{leagueId}/settings")
public class SettingsApi {

    /**
     * Lo stesso NUMERO di {@code SettingsController#MAX_NAME}, non la stessa costante:
     * ognuna e' dichiarata per conto suo, e i due messaggi d'errore sono duplicati a
     * mano nei due file. Muore con {@code SettingsController} nella tappa 6, quando la
     * schermata Thymeleaf lascia il posto a questa e resta una sola dichiarazione.
     */
    static final int MAX_NAME = 60;

    private final LeagueGuard leagues;
    private final AuctionRuntime runtime;
    private final ScoringSettingsStore scoringStore;
    private final LeagueMembersSettingsStore membersStore;
    private final AuctionSettingsStore auctionStore;
    private final AuctionSettingsHolder auctionSettings;

    public SettingsApi(LeagueGuard leagues, AuctionRuntime runtime,
                       ScoringSettingsStore scoringStore,
                       LeagueMembersSettingsStore membersStore,
                       AuctionSettingsStore auctionStore,
                       AuctionSettingsHolder auctionSettings) {
        this.leagues = leagues;
        this.runtime = runtime;
        this.scoringStore = scoringStore;
        this.membersStore = membersStore;
        this.auctionStore = auctionStore;
        this.auctionSettings = auctionSettings;
    }

    @GetMapping
    public SettingsDtos.SettingsResponse read(@PathVariable String leagueId) {
        leagues.check(leagueId);
        AuctionSettings bidder = auctionSettings.get();
        return new SettingsDtos.SettingsResponse(
                new SettingsDtos.BidderSettings(bidder.bidTimerSeconds(), bidder.beepEnabled()),
                runtime.snapshot().participants().stream().map(SettingsApi::cardOf).toList(),
                sectionOf(currentScoring()),
                runtime.hasAuction());
    }

    @PutMapping
    public SettingsDtos.SaveResult save(@PathVariable String leagueId,
                                        @RequestBody SettingsDtos.SaveRequest body) {
        leagues.check(leagueId);
        boolean preparing = !runtime.hasAuction();

        Map<String, List<String>> errors = new LinkedHashMap<>();
        errors.put("auction", new ArrayList<>());
        errors.put("participants", new ArrayList<>());
        errors.put("scoring", new ArrayList<>());
        errors.put("bidder", new ArrayList<>());

        String name = body.auctionName() == null ? "" : body.auctionName().trim();
        if (preparing) {
            if (name.isEmpty()) {
                errors.get("auction").add("Dai un nome all'asta: serve a riconoscerla "
                        + "nell'elenco quando ne avrai piu' di una.");
            } else if (name.length() > MAX_NAME) {
                errors.get("auction").add("Il nome dell'asta non puo' superare "
                        + MAX_NAME + " caratteri.");
            }
        }

        // Nessuna lettura di currentScoring() qui quando non si sta preparando: ad asta
        // aperta i parametri di punteggio non si toccano, e questo campo resta null e
        // inutilizzato fino alla fine del metodo — leggerli comunque, anche solo per
        // scartarli, contraddirebbe esattamente l'invariante appena documentato.
        ScoringSettings scoring = null;
        if (preparing) {
            // Una chiave "scoring" assente (corpo malformato, non un modulo compilato
            // male) e' un errore del CHIAMANTE: deve cadere nel 422 tipizzato qui sotto,
            // non nella NullPointerException che settingsOf() solleverebbe leggendo un
            // record null, che il ramo generico avrebbe riportato come "internal-error".
            if (body.scoring() == null) {
                errors.get("scoring").add("Le impostazioni del punteggio sono obbligatorie.");
            } else {
                scoring = settingsOf(body.scoring());
                errors.get("scoring").addAll(ScoringSettingsValidator.validate(scoring));
            }
        }

        List<Participant> members = new ArrayList<>();
        for (SettingsDtos.ParticipantSettings p : orEmpty(body.participants())) {
            // Il costruttore di Participant rifiuta un id vuoto: costruirlo comunque
            // trasformerebbe un errore di compilazione del modulo in un 422 generico
            // senza dire quale riga.
            if (p.id() == null || p.id().isBlank()) {
                errors.get("participants")
                        .add("Ogni partecipante deve avere un identificativo.");
                continue;
            }
            members.add(new Participant(p.id(), p.name(), initialOf(p.initial()), p.me()));
        }
        errors.get("participants").addAll(LeagueMembersSettingsValidator.validate(members));

        // Stessa storia del "scoring" qui sopra: una chiave "bidder" assente e' un
        // corpo malformato, non un modulo compilato male, e deve cadere nello stesso
        // 422 tipizzato invece che nella NullPointerException su
        // body.bidder().bidTimerSeconds() che il ramo generico avrebbe riportato come
        // "internal-error".
        AuctionSettings bidder = null;
        if (body.bidder() == null) {
            errors.get("bidder").add("Le preferenze del battitore sono obbligatorie.");
        } else {
            bidder = new AuctionSettings(body.bidder().bidTimerSeconds(), body.bidder().beepEnabled());
            errors.get("bidder").addAll(AuctionSettingsValidator.validate(bidder));
        }

        if (errors.values().stream().anyMatch(list -> !list.isEmpty())) {
            throw new InvalidSettingsException(errors);
        }

        if (preparing) {
            scoringStore.save(scoring);
        }
        // La configurazione generale e' il MODELLO per la prossima asta, non i
        // partecipanti di quella aperta: quelli vivono nell'asta, e riconfigurarne una
        // nuova non deve riscrivere i nomi mostrati per le precedenti.
        membersStore.save(members);
        if (!preparing) {
            runtime.setParticipants(members);
        }
        auctionStore.save(bidder);
        auctionSettings.set(bidder);
        runtime.rebuild();

        return new SettingsDtos.SaveResult(preparing ? runtime.createNew(name) : null);
    }

    private ScoringSettings currentScoring() {
        return scoringStore.load().orElseGet(
                () -> ScoringSettings.from(runtime.snapshot().chain().scoring(), defenceActive()));
    }

    /** Attivo se almeno un gradino porta un bonus: la stessa prova di SettingsController. */
    private boolean defenceActive() {
        return runtime.snapshot().chain().scoring().defenceModifier().thresholds().stream()
                .anyMatch(t -> t.bonus() != 0.0);
    }

    private static <T> List<T> orEmpty(List<T> list) {
        return list == null ? List.of() : list;
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
