package com.fantaagent.adapter.in.web;

import com.fantaagent.application.service.AuctionService;
import com.fantaagent.application.service.NoAuctionSelectedException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Comportamento di {@link NoAuctionAdvice}: chi arriva a una pagina vecchia senza
 * un'asta scelta deve tornare sotto {@code /legacy}, non alla radice — la radice ora e'
 * la SPA, e rimandarci significherebbe scambiare un errore delle pagine vecchie per un
 * cambio di applicazione silenzioso.
 *
 * <p>Non esisteva alcun test su questa classe prima d'ora: né sull'URL né su altro. Il
 * guardiano in {@link LegacyLinkPrefixTest} legge solo i template e la sintassi del
 * Java, mai il comportamento effettivo — è un test come questo, non una scansione di
 * testo, l'unico modo di verificare cosa risponde davvero il browser.
 */
@SpringBootTest
@ActiveProfiles("dev")
class NoAuctionAdviceTest {

    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private AuctionService auctionService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
        // Qualunque pagina vecchia che legga i partecipanti senza un'asta scelta
        // incontra questa eccezione: non serve altro per far scattare l'advice.
        when(auctionService.participants()).thenThrow(new NoAuctionSelectedException());
    }

    @Test
    void unaRichiestaDelBrowserTornaSottoLegacy() throws Exception {
        mockMvc.perform(get("/legacy/fragments/main"))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("/legacy"));
    }

    @Test
    void unaRichiestaHtmxUsaHxRedirectSottoLegacy() throws Exception {
        mockMvc.perform(get("/legacy/fragments/main").header("HX-Request", "true"))
                .andExpect(status().isOk())
                .andExpect(header().string("HX-Redirect", "/legacy"));
    }
}
