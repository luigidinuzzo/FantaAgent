package com.fantaagent.testsupport;

import com.fantaagent.adapter.out.file.InMemoryPlayerCatalog;
import com.fantaagent.application.port.out.AuctionTemplate;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.config.ScoringSettings;
import com.fantaagent.domain.league.ModifierTable;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.league.ScoringRules;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * I valori con cui nascono leghe e aste nei test fuori da {@code application.service}:
 * gli stessi numeri di {@code AuctionRuntimeTest}, rosa da 25 come quella vera.
 */
public final class Fixtures {

    private Fixtures() {
    }

    public static ScoringSettings scoring() {
        Map<Role, Double> bonus = new EnumMap<>(Role.class);
        for (Role role : Role.values()) {
            bonus.put(role, 3.0);
        }
        return ScoringSettings.from(new ScoringRules(true, bonus, 1.0, 3.0, -3.0, 3.0, -0.5, -1.0, -1.0, 1.0,
                new ModifierTable(3, List.of(new ModifierTable.Threshold(0.0, 0.0))),
                new ModifierTable(0, List.of(new ModifierTable.Threshold(0.0, 0.0))), 0.55), true);
    }

    public static AuctionTemplate template() {
        LeagueRulesSettings rules = new LeagueRulesSettings(500,
                Map.of(Role.P, 3, Role.D, 8, Role.C, 8, Role.A, 6));
        ScoringSettings scoring = scoring();
        return new AuctionTemplate() {
            @Override public LeagueRulesSettings rules() { return rules; }
            @Override public List<Participant> participants() { return List.of(); }
            @Override public ScoringSettings scoring() { return scoring; }
            @Override public AuctionSettings bidder() { return AuctionSettings.DEFAULTS; }
            @Override public ScoringRules scoringRules(ScoringSettings settings) {
                return settings.toScoringRules(0.55);
            }
        };
    }

    /** Quaranta giocatori per ruolo, senza statistiche: abbastanza per costruire una catena. */
    public static PlayerCatalog catalog() {
        List<Player> players = new ArrayList<>();
        for (Role role : Role.values()) {
            for (int i = 1; i <= 40; i++) {
                players.add(new Player(role.name() + i, role.name() + " " + i, "Squadra", role, 1 + i));
            }
        }
        return new InMemoryPlayerCatalog(players, List.of());
    }
}
