package com.fantaagent.adapter.in.api.league;

import com.fantaagent.domain.player.Role;
import com.fantaagent.testsupport.AuctionApiFixture;
import com.fantaagent.testsupport.TestCatalogConfig;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
@Import(TestCatalogConfig.class)
@TestPropertySource(properties = "fantaagent.data-dir=target/test-data-league-auctions-api")
class LeagueAuctionsApiTest {

    static final String PROBLEMS = "https://fantaagent.local/problems/";

    @Autowired
    private WebApplicationContext context;

    private AuctionApiFixture f;
    private String auctions;

    @BeforeEach
    void setUp() throws Exception {
        f = AuctionApiFixture.create(context);
        auctions = "/api/leagues/" + f.leagueId + "/auctions";
    }

    private void buy(String buyerId) {
        var admin = f.view(f.annaId);
        admin.write(() -> admin.service().recordPurchase(f.player(Role.P, 0), buyerId, 10, UUID.randomUUID().toString()));
    }

    @Test
    void lElencoDiceACheSegnoSiamo() throws Exception {
        buy(f.brunoId);
        f.mvc.perform(get(auctions).cookie(f.bruno))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(f.auctionId))
                .andExpect(jsonPath("$[0].purchases").value(1))
                .andExpect(jsonPath("$[0].teams").value(3))
                .andExpect(jsonPath("$[0].myBudgetRemaining").value(490))
                .andExpect(jsonPath("$[0].bidder.bidTimerSeconds").isNumber());
    }

    @Test
    void creareERinominareSonoDellAmministratore() throws Exception {
        String body = f.mvc.perform(post(auctions).with(csrf()).cookie(f.anna)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Riparazione\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Riparazione"))
                .andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(body, "$.id");

        f.mvc.perform(patch(auctions + "/" + id).with(csrf()).cookie(f.anna)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Riparazione di gennaio\",\"bidder\":{\"bidTimerSeconds\":9,\"beepEnabled\":false}}"))
                .andExpect(status().isNoContent());
        f.mvc.perform(get(auctions + "/" + id + "/board/bidder/" + f.player(Role.P, 0)).cookie(f.carla))
                .andExpect(jsonPath("$.timerSeconds").value(9));

        f.mvc.perform(post(auctions).with(csrf()).cookie(f.bruno)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Mia\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "admin-only"));
    }

    /** Il battitore letto dal tabellone pubblico: come si vede se una scrittura e' passata. */
    private int timerSeconds() throws Exception {
        String body = f.mvc.perform(get(f.url("/board/bidder/" + f.player(Role.P, 0))).cookie(f.anna))
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.timerSeconds");
    }

    @Test
    void unTimerFuoriIntervalloNonSiSalvaEIlTimerRestaComeEra() throws Exception {
        int prima = timerSeconds();

        f.mvc.perform(patch(auctions + "/" + f.auctionId).with(csrf()).cookie(f.anna)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bidder\":{\"bidTimerSeconds\":0,\"beepEnabled\":true}}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "invalid-settings"));

        assertThat(timerSeconds()).isEqualTo(prima);
    }

    /**
     * Il nome si valuta e si scrive prima del battitore: un nome vuoto deve far
     * fallire tutta la richiesta, senza che il battitore — valido di suo — venga
     * comunque salvato.
     */
    @Test
    void unNomeVuotoConBattitoreValidoNonSalvaNulla() throws Exception {
        int prima = timerSeconds();

        f.mvc.perform(patch(auctions + "/" + f.auctionId).with(csrf()).cookie(f.anna)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\",\"bidder\":{\"bidTimerSeconds\":9,\"beepEnabled\":false}}"))
                .andExpect(status().isUnprocessableEntity());

        assertThat(timerSeconds()).isEqualTo(prima);
    }

    @Test
    void soloLAmministratoreModificaAstaEPosti() throws Exception {
        f.mvc.perform(patch(auctions + "/" + f.auctionId).with(csrf()).cookie(f.bruno)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Nuovo nome\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "admin-only"));

        f.mvc.perform(delete(auctions + "/" + f.auctionId).with(csrf()).cookie(f.bruno))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "admin-only"));

        f.mvc.perform(put(f.url("/seats")).with(csrf()).cookie(f.bruno).contentType(MediaType.APPLICATION_JSON)
                        .content("[]"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "admin-only"));
    }

    @Test
    void unAstaSconosciutaDa404SuPatchEDelete() throws Exception {
        for (String id : List.of(UUID.randomUUID().toString(), "non-un-uuid")) {
            f.mvc.perform(patch(auctions + "/" + id).with(csrf()).cookie(f.anna)
                            .contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.type").value(PROBLEMS + "unknown-auction"));

            f.mvc.perform(delete(auctions + "/" + id).with(csrf()).cookie(f.anna))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.type").value(PROBLEMS + "unknown-auction"));
        }
    }

    @Test
    void unaCancellataSparisceDallElencoEDagliIndirizzi() throws Exception {
        f.mvc.perform(delete(auctions + "/" + f.auctionId).with(csrf()).cookie(f.anna))
                .andExpect(status().isNoContent());
        f.mvc.perform(get(auctions).cookie(f.anna)).andExpect(jsonPath("$.length()").value(0));
        f.mvc.perform(get(f.url("/state")).cookie(f.anna)).andExpect(status().isNotFound());
    }

    @Test
    void iPostiSiRiordinanoAncheAdAstaIniziataMaNonSiCambiano() throws Exception {
        buy(f.brunoId);
        f.mvc.perform(get(f.url("/seats")).cookie(f.bruno))
                .andExpect(jsonPath("$.locked").value(true))
                .andExpect(jsonPath("$.seats[0].displayName").value("Anna"));

        f.mvc.perform(put(f.url("/seats")).with(csrf()).cookie(f.anna).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [{"userId":"%s","teamName":"Carla FC","initial":"C"},
                                 {"userId":"%s","teamName":"Anna FC","initial":"A"},
                                 {"userId":"%s","teamName":"Bruno FC","initial":"B"}]"""
                                .formatted(f.carlaId, f.annaId, f.brunoId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seats[0].userId").value(f.carlaId));

        f.mvc.perform(put(f.url("/seats")).with(csrf()).cookie(f.anna).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [{"userId":"%s","teamName":"Nuovo nome","initial":"C"},
                                 {"userId":"%s","teamName":"Anna FC","initial":"A"},
                                 {"userId":"%s","teamName":"Bruno FC","initial":"B"}]"""
                                .formatted(f.carlaId, f.annaId, f.brunoId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "seats-locked"));
    }

    @Test
    void unTurnoConUnaSquadraSolaDiceCheNeServonoDue() throws Exception {
        f.mvc.perform(put(f.url("/seats")).with(csrf()).cookie(f.anna).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [{"userId":"%s","teamName":"Anna FC","initial":"A"}]""".formatted(f.annaId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "not-enough-seats"))
                .andExpect(jsonPath("$.detail").value("Servono almeno due squadre nel turno."));
    }

    @Test
    void chiEsceNonVedePiuLaLega() throws Exception {
        f.mvc.perform(delete("/api/leagues/" + f.leagueId + "/members/" + f.carlaId).with(csrf()).cookie(f.carla))
                .andExpect(status().isNoContent());
        f.mvc.perform(get("/api/leagues/" + f.leagueId).cookie(f.carla)).andExpect(status().isNotFound());
    }

    @Test
    void lAmministratoreNonEsceEUnMembroNonTogliePersone() throws Exception {
        f.mvc.perform(delete("/api/leagues/" + f.leagueId + "/members/" + f.annaId).with(csrf()).cookie(f.anna))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "admin-cannot-leave"));
        f.mvc.perform(delete("/api/leagues/" + f.leagueId + "/members/" + f.carlaId).with(csrf()).cookie(f.bruno))
                .andExpect(status().isForbidden());
    }
}
