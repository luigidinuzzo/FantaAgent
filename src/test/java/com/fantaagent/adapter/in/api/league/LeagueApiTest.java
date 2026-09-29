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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
class LeagueApiTest {

    static final String PROBLEMS = "https://fantaagent.local/problems/";

    @Autowired
    private WebApplicationContext context;

    private MockMvc mvc;
    private Cookie anna;
    private Cookie bruno;

    @BeforeEach
    void setUp() throws Exception {
        mvc = ApiFixture.mvc(context);
        anna = ApiFixture.register(mvc, ApiFixture.uniqueEmail("anna"), "Anna");
        bruno = ApiFixture.register(mvc, ApiFixture.uniqueEmail("bruno"), "Bruno");
    }

    String createLeague(Cookie who) throws Exception {
        String body = mvc.perform(post("/api/leagues").with(csrf()).cookie(who)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Lega del Bar\",\"teamName\":\"Anna FC\",\"initial\":\"A\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    @Test
    void creareUnaLegaERitrovarlaFraLeMie() throws Exception {
        String id = createLeague(anna);
        mvc.perform(get("/api/leagues").cookie(anna))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(id))
                .andExpect(jsonPath("$[0].admin").value(true))
                .andExpect(jsonPath("$[0].teamName").value("Anna FC"));
        mvc.perform(get("/api/leagues/" + id).cookie(anna))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.members[0].displayName").value("Anna"))
                .andExpect(jsonPath("$.members[0].me").value(true));
    }

    @Test
    void chiNonEMembroRiceve404NonUn403() throws Exception {
        String id = createLeague(anna);
        mvc.perform(get("/api/leagues/" + id).cookie(bruno))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "unknown-league"));
        mvc.perform(get("/api/leagues/" + id + "/rules").cookie(bruno))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/leagues/non-un-uuid").cookie(bruno))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "unknown-league"));
    }

    @Test
    void leRegoleSiLeggonoESiSalvano() throws Exception {
        String id = createLeague(anna);
        String rules = mvc.perform(get("/api/leagues/" + id + "/rules").cookie(anna))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canEdit").value(true))
                .andReturn().getResponse().getContentAsString();
        String scoring = new com.fasterxml.jackson.databind.ObjectMapper()
                .readTree(rules).get("scoring").toString();

        mvc.perform(put("/api/leagues/" + id + "/rules").with(csrf()).cookie(anna)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"bidder":{"bidTimerSeconds":8,"beepEnabled":false},
                                 "scoring":%s,
                                 "rules":{"budget":300,"slots":{"P":2,"D":6,"C":6,"A":4}}}""".formatted(scoring)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rules.budget").value(300))
                .andExpect(jsonPath("$.bidder.bidTimerSeconds").value(8));
    }

    @Test
    void regoleNonValideSonoDetteCampoPerCampo() throws Exception {
        String id = createLeague(anna);
        String rules = mvc.perform(get("/api/leagues/" + id + "/rules").cookie(anna))
                .andReturn().getResponse().getContentAsString();
        String scoring = new com.fasterxml.jackson.databind.ObjectMapper()
                .readTree(rules).get("scoring").toString();

        mvc.perform(put("/api/leagues/" + id + "/rules").with(csrf()).cookie(anna)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"bidder":{"bidTimerSeconds":0,"beepEnabled":false},
                                 "scoring":%s,
                                 "rules":{"budget":0,"slots":{"P":2,"D":6,"C":6,"A":4}}}""".formatted(scoring)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "invalid-settings"))
                .andExpect(jsonPath("$.errors.budget").exists());
    }

    /**
     * Un corpo senza la chiave "bidder" (un client rotto, un proxy che la perde per
     * strada) e' un errore del chiamante, non del server: deve cadere nel 422
     * tipizzato che questo endpoint costruisce, non in un errore interno per un
     * accesso a un campo assente.
     */
    @Test
    void senzaBattitoreTornaUn422SottoLaSuaChiave() throws Exception {
        String id = createLeague(anna);
        String rules = mvc.perform(get("/api/leagues/" + id + "/rules").cookie(anna))
                .andReturn().getResponse().getContentAsString();
        String scoring = new com.fasterxml.jackson.databind.ObjectMapper()
                .readTree(rules).get("scoring").toString();

        mvc.perform(put("/api/leagues/" + id + "/rules").with(csrf()).cookie(anna)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"scoring":%s,
                                 "rules":{"budget":300,"slots":{"P":2,"D":6,"C":6,"A":4}}}""".formatted(scoring)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "invalid-settings"))
                .andExpect(jsonPath("$.errors.bidder[0]").isString());
    }

    @Test
    void senzaPunteggioTornaUn422SottoLaSuaChiave() throws Exception {
        String id = createLeague(anna);

        mvc.perform(put("/api/leagues/" + id + "/rules").with(csrf()).cookie(anna)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"bidder":{"bidTimerSeconds":8,"beepEnabled":false},
                                 "rules":{"budget":300,"slots":{"P":2,"D":6,"C":6,"A":4}}}"""))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "invalid-settings"))
                .andExpect(jsonPath("$.errors.scoring[0]").isString());
    }

    @Test
    void senzaRegoleTornaUn422SottoLaSuaChiave() throws Exception {
        String id = createLeague(anna);
        String rules = mvc.perform(get("/api/leagues/" + id + "/rules").cookie(anna))
                .andReturn().getResponse().getContentAsString();
        String scoring = new com.fasterxml.jackson.databind.ObjectMapper()
                .readTree(rules).get("scoring").toString();

        mvc.perform(put("/api/leagues/" + id + "/rules").with(csrf()).cookie(anna)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"bidder":{"bidTimerSeconds":8,"beepEnabled":false},
                                 "scoring":%s}""".formatted(scoring)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "invalid-settings"))
                .andExpect(jsonPath("$.errors.rules[0]").value("Le regole della lega sono obbligatorie."));
    }

    @Test
    void datiDellaLegaNonValidi() throws Exception {
        mvc.perform(post("/api/leagues").with(csrf()).cookie(anna).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\",\"teamName\":\"Anna FC\",\"initial\":\"7\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "invalid-league"))
                .andExpect(jsonPath("$.errors.name").isArray())
                .andExpect(jsonPath("$.errors.initial").isArray());
    }

    @Test
    void rinominareELAmministratore() throws Exception {
        String id = createLeague(anna);
        mvc.perform(patch("/api/leagues/" + id).with(csrf()).cookie(anna)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Nuovo nome\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Nuovo nome"));
    }
}
