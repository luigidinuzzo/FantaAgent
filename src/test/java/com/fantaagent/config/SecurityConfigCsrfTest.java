package com.fantaagent.config;

import com.fantaagent.application.service.AuctionRuntime;
import com.fantaagent.application.service.AuctionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * {@code /legacy} non ha login e non ha lega — dal Task 15 esiste solo sotto il
 * profilo locale — e le sue pagine Thymeleaf mandano moduli {@code hx-post} senza
 * alcun token CSRF. {@code SecurityConfig} lo esclude esplicitamente dalla verifica
 * ({@code ignoringRequestMatchers("/legacy/**")}): qui si verifica che una POST
 * sotto {@code /legacy}, senza alcun token, non torni piu' un 403.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class SecurityConfigCsrfTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private AuctionRuntime auctionRuntime;

    @MockitoBean
    private AuctionService auctionService;

    @Test
    void unaPostSottoLegacySenzaTokenNonEUnForbidden() throws Exception {
        var result = mvc.perform(post("/legacy/aste/esci")).andReturn();

        assertThat(result.getResponse().getStatus())
                .describedAs("una POST sotto /legacy senza token CSRF non deve essere rifiutata dal CSRF (403)")
                .isNotEqualTo(403);
    }
}
