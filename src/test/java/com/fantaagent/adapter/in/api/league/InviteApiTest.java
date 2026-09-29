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

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
class InviteApiTest {

    static final String PROBLEMS = "https://fantaagent.local/problems/";

    @Autowired
    private WebApplicationContext context;

    private MockMvc mvc;
    private Cookie anna;
    private Cookie bruno;
    private String leagueId;

    @BeforeEach
    void setUp() throws Exception {
        mvc = ApiFixture.mvc(context);
        anna = ApiFixture.register(mvc, ApiFixture.uniqueEmail("anna"), "Anna");
        bruno = ApiFixture.register(mvc, ApiFixture.uniqueEmail("bruno"), "Bruno");
        String body = mvc.perform(post("/api/leagues").with(csrf()).cookie(anna)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Lega del Bar\",\"teamName\":\"Anna FC\",\"initial\":\"A\"}"))
                .andReturn().getResponse().getContentAsString();
        leagueId = JsonPath.read(body, "$.id");
    }

    private String createInvite() throws Exception {
        String body = mvc.perform(post("/api/leagues/" + leagueId + "/invites").with(csrf()).cookie(anna))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String link = JsonPath.read(body, "$.link");
        return link.substring(link.lastIndexOf('/') + 1);
    }

    @Test
    void lInvitoSiLeggeSenzaAccesso() throws Exception {
        String token = createInvite();
        mvc.perform(get("/api/invites/" + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.leagueName").value("Lega del Bar"))
                .andExpect(jsonPath("$.invitedBy").value("Anna"))
                .andExpect(jsonPath("$.alreadyMember").value(false));
    }

    @Test
    void accettareServeLAccessoEFaEntrare() throws Exception {
        String token = createInvite();
        mvc.perform(post("/api/invites/" + token + "/accept").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"teamName\":\"Bruno FC\",\"initial\":\"B\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/invites/" + token + "/accept").with(csrf()).cookie(bruno)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"teamName\":\"Bruno FC\",\"initial\":\"B\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(leagueId))
                .andExpect(jsonPath("$.admin").value(false));
        mvc.perform(get("/api/leagues/" + leagueId).cookie(bruno)).andExpect(status().isOk());
    }

    @Test
    void unMembroNonAmministratoreRiceve403() throws Exception {
        String token = createInvite();
        mvc.perform(post("/api/invites/" + token + "/accept").with(csrf()).cookie(bruno)
                .contentType(MediaType.APPLICATION_JSON).content("{\"teamName\":\"Bruno FC\",\"initial\":\"B\"}"));

        mvc.perform(post("/api/leagues/" + leagueId + "/invites").with(csrf()).cookie(bruno))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "admin-only"));
        mvc.perform(patch("/api/leagues/" + leagueId).with(csrf()).cookie(bruno)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Mia\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/leagues/" + leagueId + "/invites").cookie(bruno))
                .andExpect(status().isForbidden());
    }

    @Test
    void unInvitoRitiratoRisponde410() throws Exception {
        String body = mvc.perform(post("/api/leagues/" + leagueId + "/invites").with(csrf()).cookie(anna))
                .andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(body, "$.id");
        String link = JsonPath.read(body, "$.link");
        mvc.perform(delete("/api/leagues/" + leagueId + "/invites/" + id).with(csrf()).cookie(anna))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/invites/" + link.substring(link.lastIndexOf('/') + 1)))
                .andExpect(status().isGone())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "invite-unavailable"));
    }

    @Test
    void lElencoDegliInvitiNonMostraIlLink() throws Exception {
        createInvite();
        mvc.perform(get("/api/leagues/" + leagueId + "/invites").cookie(anna))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").exists())
                .andExpect(jsonPath("$[0].link").doesNotExist());
    }
}
