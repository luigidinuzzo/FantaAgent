package com.fantaagent.adapter.in.api;

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

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
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
@Import(TestCatalogConfig.class)
@TestPropertySource(properties = "fantaagent.data-dir=target/test-data-api-problem-shape")
class ApiProblemShapeTest {

    @Autowired
    private WebApplicationContext context;

    private AuctionApiFixture f;

    @BeforeEach
    void setUp() throws Exception {
        f = AuctionApiFixture.create(context);
    }

    @Test
    void unSeqNonNumericoDaUnProblemTipizzato() throws Exception {
        f.mvc.perform(post(f.url("/purchases/pippo/void")).with(csrf()).cookie(f.anna))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.type")
                        .value("https://fantaagent.local/problems/invalid-path-variable"));
    }

    @Test
    void unCorpoJsonMalformatoDaUnProblemTipizzato() throws Exception {
        f.mvc.perform(post(f.url("/purchases")).with(csrf()).cookie(f.anna)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{non e' json"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.type")
                        .value("https://fantaagent.local/problems/malformed-body"));
    }

    @Test
    void ilMetodoSbagliatoEsceInProblemJson() throws Exception {
        f.mvc.perform(get(f.url("/purchases")).cookie(f.anna))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
    }

    @Test
    void unaRottaInesistenteSottoApiDaUnProblemTipizzato() throws Exception {
        f.mvc.perform(get(f.url("/non-esiste")).cookie(f.anna))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.type")
                        .value("https://fantaagent.local/problems/unknown-endpoint"));
    }
}
