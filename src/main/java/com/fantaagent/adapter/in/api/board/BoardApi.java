package com.fantaagent.adapter.in.api.board;

import com.fantaagent.adapter.in.api.LeagueGuard;
import com.fantaagent.application.service.AuctionService;
import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.auction.Holding;
import com.fantaagent.domain.auction.Squad;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Role;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/leagues/{leagueId}/auctions/{auctionId}")
public class BoardApi {

    private final LeagueGuard leagues;
    private final AuctionService auction;

    public BoardApi(LeagueGuard leagues, AuctionService auction) {
        this.leagues = leagues;
        this.auction = auction;
    }

    @GetMapping("/board")
    public BoardDtos.BoardResponse board(@PathVariable String leagueId) {
        leagues.check(leagueId);
        AuctionState state = auction.state();
        List<BoardDtos.BoardColumn> columns = auction.participants().stream()
                .map(p -> column(p, state.squadOf(p.id())))
                .toList();
        return new BoardDtos.BoardResponse(auction.auctionId(), state.currentPhase(), columns);
    }

    private BoardDtos.BoardColumn column(Participant p, Squad squad) {
        Map<Role, List<BoardDtos.BoardSlot>> byRole = new LinkedHashMap<>();
        for (Role role : Role.values()) {
            byRole.put(role, squad.holdings().stream()
                    .filter(h -> h.role() == role)
                    .map(this::slot)
                    .toList());
        }
        return new BoardDtos.BoardColumn(p.id(), p.name(), p.me(),
                squad.budgetRemaining(), squad.slotsRemaining(), byRole);
    }

    private BoardDtos.BoardSlot slot(Holding h) {
        return new BoardDtos.BoardSlot(h.seq(), auction.playerName(h), h.price());
    }
}
