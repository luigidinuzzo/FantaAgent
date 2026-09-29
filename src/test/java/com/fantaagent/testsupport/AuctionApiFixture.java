package com.fantaagent.testsupport;

import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.application.service.auction.AuctionRegistry;
import com.fantaagent.application.service.auction.AuctionView;
import com.fantaagent.application.service.auction.LeagueAuctionService;
import com.fantaagent.application.service.league.LeagueService;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;
import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Una lega vera con un'asta vera, costruita come la costruirebbero le persone:
 * registrazione, lega, invito, e l'asta creata dal servizio (la sua API arriva col
 * Task 15). Anna e' l'amministratrice; Bruno e Carla sono membri con un posto.
 */
public final class AuctionApiFixture {

    public MockMvc mvc;
    public Cookie anna;
    public Cookie bruno;
    public Cookie carla;
    public String annaId;
    public String brunoId;
    public String carlaId;
    public String leagueId;
    public String auctionId;
    private WebApplicationContext context;
    private String inviteToken;

    public static AuctionApiFixture create(WebApplicationContext context) throws Exception {
        AuctionApiFixture f = new AuctionApiFixture();
        f.context = context;
        f.mvc = ApiFixture.mvc(context);
        f.anna = ApiFixture.register(f.mvc, ApiFixture.uniqueEmail("anna"), "Anna");
        f.annaId = f.idOf(f.anna);
        String league = f.mvc.perform(post("/api/leagues").with(csrf()).cookie(f.anna)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Lega del Bar\",\"teamName\":\"Anna FC\",\"initial\":\"A\"}"))
                .andReturn().getResponse().getContentAsString();
        f.leagueId = JsonPath.read(league, "$.id");
        String invite = f.mvc.perform(post("/api/leagues/" + f.leagueId + "/invites").with(csrf()).cookie(f.anna))
                .andReturn().getResponse().getContentAsString();
        String link = JsonPath.read(invite, "$.link");
        f.inviteToken = link.substring(link.lastIndexOf('/') + 1);
        f.bruno = f.join("Bruno");
        f.brunoId = f.idOf(f.bruno);
        f.carla = f.join("Carla");
        f.carlaId = f.idOf(f.carla);

        LeagueService leagues = context.getBean(LeagueService.class);
        f.auctionId = context.getBean(LeagueAuctionService.class)
                .create(leagues.access(UUID.fromString(f.leagueId), UUID.fromString(f.annaId)), "Asta d'estate")
                .id().toString();
        return f;
    }

    public String url(String path) {
        return "/api/leagues/" + leagueId + "/auctions/" + auctionId + path;
    }

    /** Qualcuno con un account ma fuori dalla lega. */
    public Cookie stranger(String name) throws Exception {
        return ApiFixture.register(mvc, ApiFixture.uniqueEmail(name.toLowerCase()), name);
    }

    /** Qualcuno che entra nella lega col link d'invito, ora. */
    public Cookie join(String name) throws Exception {
        Cookie cookie = stranger(name);
        mvc.perform(post("/api/invites/" + inviteToken + "/accept").with(csrf()).cookie(cookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"teamName\":\"%s FC\",\"initial\":\"%s\"}".formatted(name, name.substring(0, 1))));
        return cookie;
    }

    /** L'asta vista da un utente, per scrivere nel registro senza passare dall'API. */
    public AuctionView view(String userId) {
        LeagueService leagues = context.getBean(LeagueService.class);
        return context.getBean(AuctionRegistry.class)
                .view(leagues.access(UUID.fromString(leagueId), UUID.fromString(userId)), UUID.fromString(auctionId));
    }

    /** Il giocatore n-esimo di quel ruolo nel listone vero, in ordine di id. */
    public String player(Role role, int index) {
        List<Player> players = context.getBean(PlayerCatalog.class).all().stream()
                .filter(p -> p.role() == role)
                .sorted(java.util.Comparator.comparing(Player::id))
                .toList();
        return players.get(index).id();
    }

    private String idOf(Cookie session) throws Exception {
        String me = mvc.perform(get("/api/me").cookie(session)).andReturn().getResponse().getContentAsString();
        return JsonPath.read(me, "$.id");
    }
}
