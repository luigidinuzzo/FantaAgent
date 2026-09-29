package com.fantaagent.adapter.in.api;

import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.application.service.auction.AuctionView;
import com.fantaagent.application.service.auction.LeagueAuctionService;
import com.fantaagent.application.service.league.LeagueService;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.domain.player.Role;
import com.fantaagent.testsupport.AuctionApiFixture;
import com.fantaagent.testsupport.TestCatalogConfig;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.context.WebApplicationContext;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.lessThanOrEqualTo;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Il profilo {@code dev} tiene il catalogo vuoto per ogni altro test (si veda il
 * commento su {@code fantaagent.data-dir} in {@code application.yml}): qui serve un
 * catalogo non vuoto, perche' {@link AuctionApiFixture#player} lo sfoglia per ruolo e i
 * consigli confrontati fra i test devono differire da un giocatore all'altro. Niente
 * listone vero, pero': {@code res/*.xlsx} non e' versionato (gitignored), quindi un
 * clone pulito non ce l'ha, e un test non deve comunque poter scrivere sopra i file
 * veri della lega. {@link TestCatalogConfig} sostituisce il {@code PlayerCatalog} con
 * quello sintetico di {@code Fixtures.catalog()}; {@code fantaagent.data-dir} punta a
 * una cartella sotto {@code target/} — vuota, non tracciata — cosi' anche gli altri
 * bean che leggono file di lega (impostazioni, archivio) non toccano {@code res/}.
 */
@SpringBootTest
@ActiveProfiles("dev")
@Import(TestCatalogConfig.class)
@TestPropertySource(properties = "fantaagent.data-dir=target/test-data-api")
class AuctionReadApiTest {

    static final String PROBLEMS = "https://fantaagent.local/problems/";

    @Autowired
    private WebApplicationContext context;

    private AuctionApiFixture f;

    @BeforeEach
    void setUp() throws Exception {
        f = AuctionApiFixture.create(context);
    }

    private void buy(String playerId, String buyerId, int price) {
        AuctionView admin = f.view(f.annaId);
        admin.write(() -> admin.service().recordPurchase(playerId, buyerId, price, UUID.randomUUID().toString()));
    }

    @Test
    void loStatoDiceChiGuardaESeEAmministratore() throws Exception {
        f.mvc.perform(get(f.url("/state")).cookie(f.bruno))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.auctionId").value(f.auctionId))
                .andExpect(jsonPath("$.auctionName").value("Asta d'estate"))
                .andExpect(jsonPath("$.myParticipantId").value(f.brunoId))
                .andExpect(jsonPath("$.admin").value(false))
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.participants.length()").value(3));
        f.mvc.perform(get(f.url("/state")).cookie(f.anna))
                .andExpect(jsonPath("$.admin").value(true))
                .andExpect(jsonPath("$.myParticipantId").value(f.annaId));
    }

    @Test
    void laVersioneCresceAOgniEvento() throws Exception {
        buy(f.player(Role.P, 0), f.brunoId, 10);
        f.mvc.perform(get(f.url("/state")).cookie(f.carla)).andExpect(jsonPath("$.version").value(2));
    }

    @Test
    void chiNonEDellaLegaNonVedeNiente() throws Exception {
        Cookie dario = f.stranger("Dario");
        for (String path : new String[]{"/state", "/board", "/players?q=a", "/export.csv"}) {
            f.mvc.perform(get(f.url(path)).cookie(dario))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.type").value(PROBLEMS + "unknown-league"));
        }
    }

    @Test
    void unAstaInesistenteEUn404() throws Exception {
        f.mvc.perform(get("/api/leagues/" + f.leagueId + "/auctions/" + UUID.randomUUID() + "/state").cookie(f.anna))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "unknown-auction"));
        f.mvc.perform(get("/api/leagues/" + f.leagueId + "/auctions/corrente/state").cookie(f.anna))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "unknown-auction"));
    }

    @Test
    void unAstaDiUnAltraLegaNonSiRaggiungeDallaPropria() throws Exception {
        AuctionApiFixture other = AuctionApiFixture.create(context);
        f.mvc.perform(get("/api/leagues/" + f.leagueId + "/auctions/" + other.auctionId + "/state").cookie(f.anna))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "unknown-auction"));
    }

    @Test
    void unAstaCancellataSparisce() throws Exception {
        LeagueService leagues = context.getBean(LeagueService.class);
        context.getBean(LeagueAuctionService.class).delete(
                leagues.access(UUID.fromString(f.leagueId), UUID.fromString(f.annaId)), UUID.fromString(f.auctionId));
        f.mvc.perform(get(f.url("/state")).cookie(f.anna)).andExpect(status().isNotFound());
    }

    /**
     * La garanzia che regge tutto il resto: i consigli sono di chi li chiede. Bruno ha
     * speso quasi tutto; il tetto che vede lui e' piu' basso di quello che vede Carla,
     * e nessun parametro nella richiesta gli fa vedere quello di lei.
     */
    @Test
    void iConsigliSonoSempreQuelliDelPostoDiChiChiede() throws Exception {
        buy(f.player(Role.A, 0), f.brunoId, 400);
        String target = f.player(Role.D, 0);

        int brunoCap = JsonPath.read(f.mvc.perform(get(f.url("/players/" + target + "/valuation")).cookie(f.bruno))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), "$.hardCap");
        int carlaCap = JsonPath.read(f.mvc.perform(get(f.url("/players/" + target + "/valuation")).cookie(f.carla))
                .andReturn().getResponse().getContentAsString(), "$.hardCap");
        int brunoAskingForCarla = JsonPath.read(f.mvc.perform(
                        get(f.url("/players/" + target + "/valuation?participantId=" + f.carlaId + "&seat=" + f.carlaId))
                                .cookie(f.bruno))
                .andReturn().getResponse().getContentAsString(), "$.hardCap");

        assertThat(brunoCap).isLessThan(carlaCap);
        assertThat(brunoAskingForCarla).isEqualTo(brunoCap);
    }

    @Test
    void lAmministratoreNonVedeIConsigliDegliAltri() throws Exception {
        buy(f.player(Role.A, 0), f.annaId, 400);
        String target = f.player(Role.D, 0);
        int annaCap = JsonPath.read(f.mvc.perform(get(f.url("/players/" + target + "/valuation")).cookie(f.anna))
                .andReturn().getResponse().getContentAsString(), "$.hardCap");
        int brunoCap = JsonPath.read(f.mvc.perform(get(f.url("/players/" + target + "/valuation")).cookie(f.bruno))
                .andReturn().getResponse().getContentAsString(), "$.hardCap");
        assertThat(annaCap).isLessThan(brunoCap);
    }

    @Test
    void chiEntraDopoIlPrimoAcquistoGuardaMaNonHaConsigli() throws Exception {
        buy(f.player(Role.P, 0), f.brunoId, 10);
        Cookie dario = f.join("Dario");

        f.mvc.perform(get(f.url("/state")).cookie(dario))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.myParticipantId").doesNotExist());
        f.mvc.perform(get(f.url("/board")).cookie(dario)).andExpect(status().isOk());
        f.mvc.perform(get(f.url("/players?q=a")).cookie(dario)).andExpect(status().isOk());
        for (String path : new String[]{"/players/" + f.player(Role.D, 0) + "/valuation",
                "/players/phase", "/players/targets"}) {
            f.mvc.perform(get(f.url(path)).cookie(dario))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.type").value(PROBLEMS + "no-seat"));
        }
    }

    @Test
    void ilTabelloneSegnaLaColonnaDiChiGuarda() throws Exception {
        String player = f.player(Role.P, 0);
        String playerName = context.getBean(PlayerCatalog.class).byId(player).orElseThrow().name();
        buy(player, f.carlaId, 10);

        f.mvc.perform(get(f.url("/board")).cookie(f.carla))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.columns.length()").value(3))
                .andExpect(jsonPath("$.columns[?(@.participantId == '%s')].me".formatted(f.carlaId)).value(true))
                .andExpect(jsonPath("$.columns[?(@.participantId == '%s')].byRole.P[0].playerName"
                        .formatted(f.carlaId)).value(playerName))
                .andExpect(jsonPath("$.columns[?(@.participantId == '%s')].byRole.P[0].price"
                        .formatted(f.carlaId)).value(10));
    }

    @Test
    void laTabellaDiFaseHaUnTettoEUnOrdineDiRipiego() throws Exception {
        f.mvc.perform(get(f.url("/players/phase?limit=1000&sort=inventato")).cookie(f.bruno))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows.length()").value(lessThanOrEqualTo(25)));
        f.mvc.perform(get(f.url("/players/targets?limit=1000")).cookie(f.bruno))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(lessThanOrEqualTo(10)));
    }

    @Test
    void unGiocatoreSconosciutoEUn404() throws Exception {
        f.mvc.perform(get(f.url("/players/inventato/valuation")).cookie(f.bruno))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "unknown-player"));
    }

    /**
     * Il nome dell'asta e' "Asta d'estate": l'apostrofo non e' fra gli {@code
     * attr-char} di RFC 5987 (a differenza di lettere, cifre e pochi altri segni), e
     * lo spazio nemmeno — {@code ContentDisposition.attachment().filename(..., UTF_8)}
     * li percento-codifica entrambi, com'era gia' verificato per la virgoletta e gli
     * accenti nel vecchio {@code ExportApiTest}.
     */
    @Test
    void lExportPortaIlNomeDellAsta() throws Exception {
        f.mvc.perform(get(f.url("/export.csv")).cookie(f.bruno))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/csv"))
                .andExpect(header().string("Content-Disposition",
                        containsString("filename*=UTF-8''rose-Asta%20d%27estate.csv")));
    }

    @Test
    void ilBanditorePubblicoLeggeIlTempoDellAsta() throws Exception {
        LeagueService leagues = context.getBean(LeagueService.class);
        context.getBean(LeagueAuctionService.class).updateBidder(
                leagues.access(UUID.fromString(f.leagueId), UUID.fromString(f.annaId)),
                UUID.fromString(f.auctionId), new AuctionSettings(9, false));

        f.mvc.perform(get(f.url("/board/bidder/" + f.player(Role.P, 0))).cookie(f.carla))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timerSeconds").value(9))
                .andExpect(jsonPath("$.beepEnabled").value(false))
                .andExpect(jsonPath("$.maxBid").doesNotExist())
                .andExpect(jsonPath("$.hardCap").doesNotExist());
    }
}
