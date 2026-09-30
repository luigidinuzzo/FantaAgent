package com.fantaagent.adapter.in.api.league;

import com.fantaagent.testsupport.ApiFixture;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.WebApplicationContext;

import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
class JoinRequestApiTest {

    static final String PROBLEMS = "https://fantaagent.local/problems/";

    @Autowired
    private WebApplicationContext context;

    private MockMvc mvc;
    private Cookie anna;
    private Cookie bruno;
    private String leagueId;
    private String leagueName;

    @BeforeEach
    void setUp() throws Exception {
        mvc = ApiFixture.mvc(context);
        anna = ApiFixture.register(mvc, ApiFixture.uniqueEmail("anna"), "Anna");
        bruno = ApiFixture.register(mvc, ApiFixture.uniqueEmail("bruno"), "Bruno");
        // Il database e' lo stesso per tutti i test del contesto: un nome che solo questo trova.
        leagueName = "Lega " + UUID.randomUUID().toString().substring(0, 8);
        String body = mvc.perform(post("/api/leagues").with(csrf()).cookie(anna)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + leagueName + "\",\"teamName\":\"Anna FC\"}"))
                .andReturn().getResponse().getContentAsString();
        leagueId = JsonPath.read(body, "$.id");
    }

    private void ask() throws Exception {
        mvc.perform(post("/api/join-requests/" + leagueId).with(csrf()).cookie(bruno)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"teamName\":\"Bruno FC\"}"))
                .andExpect(status().isNoContent());
    }

    @Test
    void siCercaSiChiedeESiViene_accettati() throws Exception {
        mvc.perform(get("/api/leagues/search").param("q", leagueName).cookie(bruno))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(leagueId))
                .andExpect(jsonPath("$[0].adminName").value("Anna"))
                .andExpect(jsonPath("$[0].members").value(1))
                .andExpect(jsonPath("$[0].status").value("NONE"));

        ask();
        mvc.perform(get("/api/leagues/search").param("q", leagueName).cookie(bruno))
                .andExpect(jsonPath("$[0].status").value("PENDING"));
        mvc.perform(get("/api/join-requests").cookie(bruno))
                .andExpect(jsonPath("$[0].leagueName").value(leagueName))
                .andExpect(jsonPath("$[0].teamName").value("Bruno FC"));
        mvc.perform(get("/api/leagues").cookie(anna))
                .andExpect(jsonPath("$[0].pendingRequests").value(1))
                .andExpect(jsonPath("$[0].members").value(1))
                .andExpect(jsonPath("$[0].auctions").value(0));

        String bruno = JsonPath.read(mvc.perform(get("/api/leagues/" + leagueId + "/join-requests").cookie(anna))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].displayName").value("Bruno"))
                .andReturn().getResponse().getContentAsString(), "$[0].userId");
        mvc.perform(post("/api/leagues/" + leagueId + "/join-requests/" + bruno + "/approve").with(csrf()).cookie(anna))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/leagues/" + leagueId).cookie(this.bruno))
                .andExpect(status().isOk());
    }

    @Test
    void soloLAmministratoreVedeLeRichieste() throws Exception {
        ask();
        mvc.perform(get("/api/leagues/" + leagueId + "/join-requests").cookie(bruno))
                .andExpect(status().isNotFound());
    }

    @Test
    void unaRichiestaRitirataNonSiAccetta() throws Exception {
        ask();
        String bruno = JsonPath.read(mvc.perform(get("/api/leagues/" + leagueId + "/join-requests").cookie(anna))
                .andReturn().getResponse().getContentAsString(), "$[0].userId");
        mvc.perform(delete("/api/join-requests/" + leagueId).with(csrf()).cookie(this.bruno))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/leagues/" + leagueId + "/join-requests/" + bruno + "/approve").with(csrf()).cookie(anna))
                .andExpect(status().isGone())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "join-request-gone"));
    }

    @Test
    void laRicercaVuoleLAccesso() throws Exception {
        mvc.perform(get("/api/leagues/search").param("q", leagueName))
                .andExpect(status().isUnauthorized());
    }
}
