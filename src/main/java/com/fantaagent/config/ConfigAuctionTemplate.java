package com.fantaagent.config;

import com.fantaagent.application.port.out.AuctionTemplate;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.league.ScoringRules;

import java.util.EnumMap;
import java.util.List;

/**
 * Il modello letto da application.yml e dai file globali in data-dir: i valori con cui
 * si giocava prima che ogni asta avesse i suoi. In sola lettura per la SPA.
 */
public class ConfigAuctionTemplate implements AuctionTemplate {

    private final LeagueProperties props;
    private final ScoringSettingsStore scoringStore;
    private final LeagueMembersSettingsStore membersStore;
    private final AuctionSettingsStore auctionStore;

    public ConfigAuctionTemplate(LeagueProperties props, ScoringSettingsStore scoringStore,
                                 LeagueMembersSettingsStore membersStore,
                                 AuctionSettingsStore auctionStore) {
        this.props = props;
        this.scoringStore = scoringStore;
        this.membersStore = membersStore;
        this.auctionStore = auctionStore;
    }

    @Override
    public LeagueRulesSettings rules() {
        return new LeagueRulesSettings(props.budget(), new EnumMap<>(props.slots()));
    }

    @Override
    public List<Participant> participants() {
        return BeanConfig.loadParticipants(props, membersStore);
    }

    @Override
    public ScoringSettings scoring() {
        return scoringStore.load().orElseGet(() ->
                ScoringSettings.from(SettingsConfig.loadScoringRules(scoringStore, props), true));
    }

    @Override
    public AuctionSettings bidder() {
        return auctionStore.load().orElse(AuctionSettings.DEFAULTS);
    }

    /**
     * Senza {@code league-settings.yml} globale il punteggio in vigore oggi e' quello di
     * application.yml, tabella del portiere compresa. {@link ScoringSettings} non ha
     * quella tabella (la lega non la usa), quindi il giro ScoringRules → ScoringSettings
     * → ScoringRules la perderebbe. Finche' il punteggio e' ESATTAMENTE quello del
     * modello non toccato, si restituiscono le regole originali.
     */
    @Override
    public ScoringRules scoringRules(ScoringSettings settings) {
        if (!scoringStore.exists()) {
            ScoringRules fromYml = SettingsConfig.fromProperties(props);
            if (settings.equals(ScoringSettings.from(fromYml, true))) {
                return fromYml;
            }
        }
        return settings.toScoringRules(props.scoring().matchdayRatingSigma());
    }
}
