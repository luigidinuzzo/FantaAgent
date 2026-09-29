package com.fantaagent.adapter.in.api.league;

import com.fantaagent.adapter.in.api.ApiAccess;
import com.fantaagent.adapter.in.api.InvalidSettingsException;
import com.fantaagent.adapter.in.security.AppUserPrincipal;
import com.fantaagent.application.port.out.AuctionRecord;
import com.fantaagent.application.port.out.LeagueMember;
import com.fantaagent.application.port.out.Seat;
import com.fantaagent.application.service.auction.AuctionNotFoundException;
import com.fantaagent.application.service.auction.LeagueAuctionService;
import com.fantaagent.application.service.auction.SeatRequest;
import com.fantaagent.application.service.league.InvalidLeagueDataException;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.application.service.league.LeagueService;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.AuctionSettingsValidator;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/leagues/{leagueId}/auctions")
public class LeagueAuctionsApi {

    private final ApiAccess access;
    private final LeagueAuctionService auctions;
    private final LeagueService leagues;

    public LeagueAuctionsApi(ApiAccess access, LeagueAuctionService auctions, LeagueService leagues) {
        this.access = access;
        this.auctions = auctions;
        this.leagues = leagues;
    }

    @GetMapping
    public List<LeagueDtos.AuctionCardView> list(@AuthenticationPrincipal AppUserPrincipal me,
                                                 @PathVariable String leagueId) {
        return auctions.list(access.league(leagueId, me)).stream().map(LeagueDtos.AuctionCardView::of).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LeagueDtos.AuctionCardView create(@AuthenticationPrincipal AppUserPrincipal me,
                                             @PathVariable String leagueId,
                                             @RequestBody LeagueDtos.CreateAuctionRequest body) {
        LeagueAccess league = access.league(leagueId, me);
        AuctionRecord created = auctions.create(league, body.name());
        return auctions.list(league).stream().filter(c -> c.id().equals(created.id())).findFirst()
                .map(LeagueDtos.AuctionCardView::of).orElseThrow();
    }

    @PatchMapping("/{auctionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void update(@AuthenticationPrincipal AppUserPrincipal me, @PathVariable String leagueId,
                       @PathVariable String auctionId, @RequestBody LeagueDtos.UpdateAuctionRequest body) {
        LeagueAccess league = access.league(leagueId, me);
        UUID id = auctionIdOf(auctionId);
        if (body.bidder() != null) {
            AuctionSettings bidder = new AuctionSettings(body.bidder().bidTimerSeconds(), body.bidder().beepEnabled());
            Map<String, List<String>> errors = AuctionSettingsValidator.validateByField(bidder);
            if (!errors.isEmpty()) {
                throw new InvalidSettingsException(errors);
            }
            auctions.updateBidder(league, id, bidder);
        }
        if (body.name() != null) {
            auctions.rename(league, id, body.name());
        }
    }

    @DeleteMapping("/{auctionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AppUserPrincipal me, @PathVariable String leagueId,
                       @PathVariable String auctionId) {
        auctions.delete(access.league(leagueId, me), auctionIdOf(auctionId));
    }

    @GetMapping("/{auctionId}/seats")
    public LeagueDtos.SeatsView seats(@AuthenticationPrincipal AppUserPrincipal me, @PathVariable String leagueId,
                                      @PathVariable String auctionId) {
        LeagueAccess league = access.league(leagueId, me);
        UUID id = auctionIdOf(auctionId);
        return view(league, auctions.seatsLocked(league, id), auctions.seats(league, id));
    }

    @PutMapping("/{auctionId}/seats")
    public LeagueDtos.SeatsView replaceSeats(@AuthenticationPrincipal AppUserPrincipal me,
                                             @PathVariable String leagueId, @PathVariable String auctionId,
                                             @RequestBody List<LeagueDtos.SeatInput> body) {
        LeagueAccess league = access.league(leagueId, me);
        UUID id = auctionIdOf(auctionId);
        List<SeatRequest> requested = body.stream()
                .map(s -> new SeatRequest(uuidOrNull(s.userId()), s.teamName(), s.initial()))
                .toList();
        List<Seat> seats = auctions.replaceSeats(league, id, requested);
        return view(league, auctions.seatsLocked(league, id), seats);
    }

    /**
     * Il nome della persona accanto a quello della squadra. Chi ha lasciato la lega
     * resta nei posti delle aste gia' iniziate, ma non ha piu' un nome da mostrare:
     * si mostra la squadra.
     */
    private LeagueDtos.SeatsView view(LeagueAccess league, boolean locked, List<Seat> seats) {
        Map<UUID, String> names = leagues.members(league).stream()
                .collect(Collectors.toMap(LeagueMember::userId, LeagueMember::displayName));
        return new LeagueDtos.SeatsView(locked, seats.stream()
                .map(s -> new LeagueDtos.SeatView(s.userId().toString(),
                        names.getOrDefault(s.userId(), s.teamName()), s.teamName(),
                        String.valueOf(s.initial()), s.position()))
                .toList());
    }

    private static UUID auctionIdOf(String raw) {
        return ApiAccess.parseOr404(raw, () -> new AuctionNotFoundException(null));
    }

    private static UUID uuidOrNull(String raw) {
        try {
            return raw == null ? null : UUID.fromString(raw);
        } catch (IllegalArgumentException e) {
            throw new InvalidLeagueDataException(Map.of("seats", List.of("Ogni posto va a un membro diverso della lega.")));
        }
    }
}
