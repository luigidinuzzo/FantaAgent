package com.fantaagent.adapter.in.api;

import com.fantaagent.domain.player.Role;
import com.fantaagent.testsupport.AuctionApiFixture;
import com.fantaagent.testsupport.TestCatalogConfig;
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

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
@Import(TestCatalogConfig.class)
@TestPropertySource(properties = "fantaagent.data-dir=target/test-data-my-auctions-api")
class MyAuctionsApiTest {

    @Autowired
    private WebApplicationContext context;

    private AuctionApiFixture f;

    @BeforeEach
    void setUp() throws Exception {
        f = AuctionApiFixture.create(context);
    }

    private void buy(String buyerId) {
        var admin = f.view(f.annaId);
        admin.write(() -> admin.service().recordPurchase(f.player(Role.P, 0), buyerId, 10, UUID.randomUUID().toString()));
    }

    @Test
    void unAstaAppenaCreataEDaIniziare() throws Exception {
        f.mvc.perform(get("/api/auctions").cookie(f.bruno))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(f.auctionId))
                .andExpect(jsonPath("$[0].leagueId").value(f.leagueId))
                .andExpect(jsonPath("$[0].leagueName").isString())
                .andExpect(jsonPath("$[0].status").value("NOT_STARTED"))
                .andExpect(jsonPath("$[0].admin").value(false))
                .andExpect(jsonPath("$[0].lastActivity").isString());
    }

    @Test
    void dopoUnAcquistoEInCorsoEDiceQuantoTiResta() throws Exception {
        buy(f.brunoId);
        f.mvc.perform(get("/api/auctions").cookie(f.bruno))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$[0].phase").value("P"))
                .andExpect(jsonPath("$[0].budgetRemaining").value(490));
        f.mvc.perform(get("/api/auctions").cookie(f.anna))
                .andExpect(jsonPath("$[0].admin").value(true));
    }

    @Test
    void lePiuRecentiPrima() throws Exception {
        f.mvc.perform(post("/api/leagues/" + f.leagueId + "/auctions").with(csrf()).cookie(f.anna)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Riparazione\"}"))
                .andExpect(status().isCreated());
        f.mvc.perform(get("/api/auctions").cookie(f.anna))
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].name").value("Riparazione"));
        buy(f.brunoId);
        f.mvc.perform(get("/api/auctions").cookie(f.anna))
                .andExpect(jsonPath("$[0].id").value(f.auctionId));
    }

    @Test
    void chiNonEInLegaNonVedeNiente() throws Exception {
        f.mvc.perform(get("/api/auctions").cookie(f.stranger("Dario")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void leAsteEliminateNonCompaiono() throws Exception {
        f.mvc.perform(delete("/api/leagues/" + f.leagueId + "/auctions/" + f.auctionId).with(csrf()).cookie(f.anna))
                .andExpect(status().isNoContent());
        f.mvc.perform(get("/api/auctions").cookie(f.anna))
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void chiEToltoDallaLegaNonVedePiuLeSueAste() throws Exception {
        buy(f.brunoId);
        f.mvc.perform(delete("/api/leagues/" + f.leagueId + "/members/" + f.brunoId).with(csrf()).cookie(f.anna))
                .andExpect(status().isNoContent());
        f.mvc.perform(get("/api/auctions").cookie(f.bruno))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void senzaAccessoEUn401() throws Exception {
        f.mvc.perform(get("/api/auctions")).andExpect(status().isUnauthorized());
    }
}
