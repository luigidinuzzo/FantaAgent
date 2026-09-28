package com.fantaagent.adapter.in.api.league;

import com.fantaagent.adapter.in.api.ApiAccess;
import com.fantaagent.adapter.in.api.InvalidSettingsException;
import com.fantaagent.adapter.in.api.dto.SettingsDtos;
import com.fantaagent.adapter.in.security.AppUserPrincipal;
import com.fantaagent.application.port.out.League;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.application.service.league.LeagueService;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.AuctionSettingsValidator;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.config.LeagueRulesValidator;
import com.fantaagent.config.ScoringSettings;
import com.fantaagent.config.ScoringSettingsValidator;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
 * Le regole con cui nasceranno le prossime aste della lega. Si leggono da membri, si
 * cambiano da amministratori; le aste gia' create hanno le loro, fotografate alla
 * nascita, e da qui non si toccano.
 */
@RestController
@RequestMapping("/api/leagues/{leagueId}/rules")
public class LeagueSettingsApi {

    private final ApiAccess access;
    private final LeagueService leagues;

    public LeagueSettingsApi(ApiAccess access, LeagueService leagues) {
        this.access = access;
        this.leagues = leagues;
    }

    @GetMapping
    public LeagueDtos.LeagueRulesResponse read(@AuthenticationPrincipal AppUserPrincipal me,
                                               @PathVariable String leagueId) {
        LeagueAccess league = access.league(leagueId, me);
        return response(league.league(), league.isAdmin());
    }

    @PutMapping
    public LeagueDtos.LeagueRulesResponse save(@AuthenticationPrincipal AppUserPrincipal me,
                                               @PathVariable String leagueId,
                                               @RequestBody LeagueDtos.SaveLeagueRulesRequest body) {
        LeagueAccess league = access.admin(leagueId, me);
        Map<String, List<String>> errors = new LinkedHashMap<>();
        if (body.bidder() == null) {
            add(errors, "bidder", "Le preferenze del banditore sono obbligatorie.");
        }
        if (body.scoring() == null) {
            add(errors, "scoring", "Le impostazioni del punteggio sono obbligatorie.");
        }
        if (body.rules() == null) {
            add(errors, "rules", "Le regole della lega sono obbligatorie.");
        }
        if (!errors.isEmpty()) {
            throw new InvalidSettingsException(errors);
        }
        AuctionSettings bidder = new AuctionSettings(body.bidder().bidTimerSeconds(), body.bidder().beepEnabled());
        ScoringSettings scoring = body.scoring().toSettings();
        LeagueRulesSettings rules = new LeagueRulesSettings(body.rules().budget(),
                SettingsDtos.RulesSection.rolesOf(body.rules().slots()));
        merge(errors, AuctionSettingsValidator.validateByField(bidder));
        merge(errors, ScoringSettingsValidator.validateByField(scoring));
        // Il numero di squadre non e' della lega: e' quanti membri partecipano a
        // ciascuna asta. Qui si passa il minimo perche' il validatore non lo contesti.
        merge(errors, LeagueRulesValidator.validateByField(rules, LeagueRulesValidator.MIN_PARTICIPANTS));
        if (!errors.isEmpty()) {
            throw new InvalidSettingsException(errors);
        }
        return response(leagues.updateDefaults(league, rules, scoring, bidder), true);
    }

    private static LeagueDtos.LeagueRulesResponse response(League league, boolean canEdit) {
        return new LeagueDtos.LeagueRulesResponse(
                new SettingsDtos.BidderSettings(league.bidder().bidTimerSeconds(), league.bidder().beepEnabled()),
                SettingsDtos.ScoringSection.of(league.scoring()),
                new SettingsDtos.RulesSection(league.rules().budget(), league.rules().slots()),
                canEdit);
    }

    private static void add(Map<String, List<String>> errors, String key, String message) {
        errors.computeIfAbsent(key, k -> new ArrayList<>()).add(message);
    }

    private static void merge(Map<String, List<String>> errors, Map<String, List<String>> more) {
        more.forEach((k, v) -> errors.computeIfAbsent(k, x -> new ArrayList<>()).addAll(v));
    }
}
