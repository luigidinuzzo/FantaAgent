package com.fantaagent.adapter.in.api.league;

import com.fantaagent.adapter.in.api.dto.SettingsDtos;
import com.fantaagent.application.port.out.LeagueMember;
import com.fantaagent.application.port.out.MemberRole;
import com.fantaagent.application.service.league.LeagueAccess;

import java.util.List;
import java.util.UUID;

public final class LeagueDtos {

    private LeagueDtos() {
    }

    public record CreateLeagueRequest(String name, String teamName, String initial) {
    }

    public record RenameRequest(String name) {
    }

    public record LeagueCard(String id, String name, boolean admin, String teamName, String initial) {

        public static LeagueCard of(LeagueAccess a) {
            return new LeagueCard(a.leagueId().toString(), a.league().name(), a.isAdmin(),
                    a.me().teamName(), String.valueOf(a.me().initial()));
        }
    }

    public record MemberView(String userId, String displayName, String teamName, String initial,
                             MemberRole role, boolean me) {

        public static MemberView of(LeagueMember m, UUID viewer) {
            return new MemberView(m.userId().toString(), m.displayName(), m.teamName(),
                    String.valueOf(m.initial()), m.role(), m.userId().equals(viewer));
        }
    }

    public record LeagueDetail(String id, String name, boolean admin, List<MemberView> members) {

        public static LeagueDetail of(LeagueAccess a, List<LeagueMember> members) {
            return new LeagueDetail(a.leagueId().toString(), a.league().name(), a.isAdmin(),
                    members.stream().map(m -> MemberView.of(m, a.userId())).toList());
        }
    }

    public record LeagueRulesResponse(SettingsDtos.BidderSettings bidder,
                                      SettingsDtos.ScoringSection scoring,
                                      SettingsDtos.RulesSection rules,
                                      boolean canEdit) {
    }

    public record SaveLeagueRulesRequest(SettingsDtos.BidderSettings bidder,
                                         SettingsDtos.ScoringSection scoring,
                                         SettingsDtos.RulesSection rules) {
    }
}
