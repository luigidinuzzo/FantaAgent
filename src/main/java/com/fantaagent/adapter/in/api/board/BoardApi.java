package com.fantaagent.adapter.in.api.board;

import com.fantaagent.adapter.in.api.ApiAccess;
import com.fantaagent.adapter.in.security.AppUserPrincipal;
import com.fantaagent.application.service.auction.AuctionView;
import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.auction.Holding;
import com.fantaagent.domain.auction.Squad;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Role;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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

    private final ApiAccess access;

    public BoardApi(ApiAccess access) {
        this.access = access;
    }

    @GetMapping("/board")
    public BoardDtos.BoardResponse board(@PathVariable String leagueId,
                                         @PathVariable String auctionId,
                                         @AuthenticationPrincipal AppUserPrincipal me) {
        AuctionView view = access.auction(leagueId, auctionId, me);
        AuctionState state = view.service().state();
        List<BoardDtos.BoardColumn> columns = view.participants().stream()
                .map(p -> column(view, p, state.squadOf(p.id())))
                .toList();
        return new BoardDtos.BoardResponse(view.auction().id().toString(), state.currentPhase(), columns);
    }

    private BoardDtos.BoardColumn column(AuctionView view, Participant p, Squad squad) {
        Map<Role, List<BoardDtos.BoardSlot>> byRole = new LinkedHashMap<>();
        for (Role role : Role.values()) {
            byRole.put(role, squad.holdings().stream()
                    .filter(h -> h.role() == role)
                    .map(h -> slot(view, h))
                    .toList());
        }
        return new BoardDtos.BoardColumn(p.id(), p.name(), p.me(),
                squad.budgetRemaining(), squad.slotsRemaining(), byRole);
    }

    private BoardDtos.BoardSlot slot(AuctionView view, Holding h) {
        return new BoardDtos.BoardSlot(h.seq(), view.service().playerName(h), h.price());
    }
}
