package com.fantaagent.adapter.in.api;

import com.fantaagent.application.service.AuctionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Gli errori che non lancia il dominio ma Spring, prima che il controller esista.
 *
 * <p>Erano il buco del contratto: uscivano con {@code type: about:blank} e un
 * messaggio in inglese, e il frontend — che ha un solo punto in cui legge gli
 * errori e li riconosce dal {@code type} — li mostrava cosi' com'erano a un utente
 * italiano. Questi test esistono perche' quel buco non si riapra in silenzio.
 */
@SpringBootTest
@ActiveProfiles("dev")
class ApiProblemShapeTest {

    private static final String BASE = "/api/leagues/default/auctions/corrente";

    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private AuctionService auction;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    void unSeqNonNumericoDaUnProblemTipizzato() throws Exception {
        mvc.perform(post(BASE + "/purchases/pippo/void"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.type")
                        .value("https://fantaagent.local/problems/invalid-path-variable"));
    }

    @Test
    void unCorpoJsonMalformatoDaUnProblemTipizzato() throws Exception {
        mvc.perform(post(BASE + "/purchases").contentType(MediaType.APPLICATION_JSON)
                        .content("{non e' json"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.type")
                        .value("https://fantaagent.local/problems/malformed-body"));
    }

    @Test
    void ilMetodoSbagliatoEsceInProblemJson() throws Exception {
        mvc.perform(get(BASE + "/purchases"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.type")
                        .value("https://fantaagent.local/problems/method-not-allowed"));
    }

    @Test
    void unaRottaInesistenteSottoApiDaUnProblemTipizzato() throws Exception {
        mvc.perform(get(BASE + "/non-esiste"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.type")
                        .value("https://fantaagent.local/problems/unknown-endpoint"));
    }
}
