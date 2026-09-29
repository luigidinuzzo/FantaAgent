package com.fantaagent.adapter.in.api;

import com.fantaagent.adapter.in.security.AppUserPrincipal;
import com.fantaagent.application.service.auction.AuctionNotFoundException;
import com.fantaagent.application.service.auction.AuctionRegistry;
import com.fantaagent.application.service.auction.AuctionView;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.application.service.league.LeagueService;
import com.fantaagent.application.service.league.NotLeagueMemberException;
import org.springframework.stereotype.Component;

import java.util.UUID;
import java.util.function.Supplier;

/**
 * Da un segmento dell'URL e da chi ha fatto l'accesso, cio' che un controller puo'
 * toccare. Ogni endpoint sotto una lega passa da qui per primo: e' il punto in cui
 * "chi sei" diventa "cosa puoi vedere", e non ce n'e' un secondo.
 */
@Component
public class ApiAccess {

    private final LeagueService leagues;
    private final AuctionRegistry registry;

    public ApiAccess(LeagueService leagues, AuctionRegistry registry) {
        this.leagues = leagues;
        this.registry = registry;
    }

    public LeagueAccess league(String leagueId, AppUserPrincipal me) {
        return leagues.access(parseOr404(leagueId, () -> new NotLeagueMemberException(null)), me.id());
    }

    public LeagueAccess admin(String leagueId, AppUserPrincipal me) {
        return league(leagueId, me).requireAdmin();
    }

    public AuctionView auction(String leagueId, String auctionId, AppUserPrincipal me) {
        LeagueAccess league = league(leagueId, me);
        return registry.view(league, parseOr404(auctionId, () -> new AuctionNotFoundException(null)));
    }

    /** Solo l'amministratore scrive nel registro: gli altri membri guardano. */
    public AuctionView adminAuction(String leagueId, String auctionId, AppUserPrincipal me) {
        LeagueAccess league = admin(leagueId, me);
        return registry.view(league, parseOr404(auctionId, () -> new AuctionNotFoundException(null)));
    }

    /** Un id che non e' nemmeno un UUID e' un indirizzo che non porta da nessuna parte: 404. */
    public static UUID parseOr404(String raw, Supplier<RuntimeException> notFound) {
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException e) {
            throw notFound.get();
        }
    }
}
