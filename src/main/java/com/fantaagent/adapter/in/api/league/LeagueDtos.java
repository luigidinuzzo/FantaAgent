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

    /**
     * Una lega fra le mie.
     *
     * @param pendingRequests le richieste d'ingresso da decidere; sempre 0 per chi non amministra
     */
    public record LeagueCard(String id, String name, boolean admin, String teamName, String initial,
                             int members, int auctions, int pendingRequests) {

        public static LeagueCard of(LeagueAccess a, int members, int auctions, int pendingRequests) {
            return new LeagueCard(a.leagueId().toString(), a.league().name(), a.isAdmin(),
                    a.me().teamName(), String.valueOf(a.me().initial()), members, auctions, pendingRequests);
        }
    }

    /** @param status MEMBER se chi cerca ne fa gia' parte, PENDING se ha gia' chiesto, NONE altrimenti */
    public record LeagueMatchView(String id, String name, String adminName, int members, String status) {

        public static LeagueMatchView of(com.fantaagent.application.port.out.LeagueMatch m) {
            return new LeagueMatchView(m.id().toString(), m.name(), m.adminName(), m.members(),
                    m.member() ? "MEMBER" : m.pending() ? "PENDING" : "NONE");
        }
    }

    public record JoinRequestBody(String teamName) {
    }

    /** Una richiesta mandata, vista da chi l'ha mandata. */
    public record MyJoinRequestView(String leagueId, String leagueName, String teamName,
                                    java.time.Instant requestedAt) {

        public static MyJoinRequestView of(com.fantaagent.application.port.out.JoinRequest r) {
            return new MyJoinRequestView(r.leagueId().toString(), r.leagueName(), r.teamName(), r.requestedAt());
        }
    }

    /** Una richiesta da decidere, vista dall'amministratore. */
    public record JoinRequestView(String userId, String displayName, String teamName,
                                  java.time.Instant requestedAt) {

        public static JoinRequestView of(com.fantaagent.application.port.out.JoinRequest r) {
            return new JoinRequestView(r.userId().toString(), r.displayName(), r.teamName(), r.requestedAt());
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

    public record InviteView(String id, java.time.Instant createdAt, java.time.Instant expiresAt) {

        public static InviteView of(com.fantaagent.application.port.out.Invite i) {
            return new InviteView(i.id().toString(), i.createdAt(), i.expiresAt());
        }
    }

    public record CreatedInviteView(String id, String link, java.time.Instant expiresAt) {
    }

    public record InvitePreviewView(String leagueId, String leagueName, String invitedBy,
                                    boolean alreadyMember, List<String> takenInitials) {
    }

    public record AcceptInviteRequest(String teamName, String initial) {
    }

    public record AuctionCardView(String id, String name, java.time.Instant createdAt,
                                  java.time.Instant lastWritten, int purchases,
                                  com.fantaagent.domain.player.Role phase, int teams, int budget,
                                  int totalSlots, Integer myBudgetRemaining,
                                  SettingsDtos.BidderSettings bidder) {

        public static AuctionCardView of(com.fantaagent.application.service.auction.AuctionCard c) {
            return new AuctionCardView(c.id().toString(), c.name(), c.createdAt(), c.lastWritten(),
                    c.purchases(), c.phase(), c.teams(), c.budget(), c.totalSlots(), c.myBudgetRemaining(),
                    new SettingsDtos.BidderSettings(c.bidder().bidTimerSeconds(), c.bidder().beepEnabled()));
        }
    }

    public record CreateAuctionRequest(String name) {
    }

    public record UpdateAuctionRequest(String name, SettingsDtos.BidderSettings bidder) {
    }

    public record SeatView(String userId, String displayName, String teamName, String initial, int position) {
    }

    public record SeatsView(boolean locked, List<SeatView> seats) {
    }

    public record SeatInput(String userId, String teamName, String initial) {
    }
}
