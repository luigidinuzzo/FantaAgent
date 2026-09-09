package com.fantaagent.adapter.in.api.board;

import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.application.service.AuctionService;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.nio.charset.StandardCharsets;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
class PublicBidderApiTest {

    private static final String URL =
            "/api/leagues/default/auctions/corrente/board/bidder/d1";

    private static final Player BASTONI = new Player("d1", "Bastoni", "Inter", Role.D, 20);

    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private PlayerCatalog catalog;

    @MockitoBean
    private AuctionService auction;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
        when(catalog.byId("d1")).thenReturn(Optional.of(BASTONI));
        when(auction.auctionId()).thenReturn("2026-09-02");
    }

    @Test
    void portaIlGiocatoreEleImpostazioniDelTimer() throws Exception {
        mvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.playerId").value("d1"))
                .andExpect(jsonPath("$.name").value("Bastoni"))
                .andExpect(jsonPath("$.team").value("Inter"))
                .andExpect(jsonPath("$.role").value("D"))
                .andExpect(jsonPath("$.listPrice").value(20))
                .andExpect(jsonPath("$.timerSeconds").isNumber())
                .andExpect(jsonPath("$.beepEnabled").isBoolean());
    }

    /**
     * La stessa verifica che protegge il tabellone, sullo stesso vocabolario: qui non
     * c'e' un mock da cui potrebbe uscire una valutazione, ma il test esiste perche'
     * qualcuno domani aggiungera' un campo, e questo e' il posto dove se ne accorge.
     */
    @Test
    void nonContieneNessunaParolaDelVocabolarioDelleValutazioni() throws Exception {
        MvcResult result = mvc.perform(get(URL)).andExpect(status().isOk()).andReturn();
        String json = result.getResponse().getContentAsString(StandardCharsets.UTF_8);

        assertThat(json).doesNotContain("maxBid");
        assertThat(json).doesNotContain("expectedPrice");
        assertThat(json).doesNotContain("margin");
        assertThat(json).doesNotContain("hardCap");
        assertThat(json).doesNotContain("walkAway");
        assertThat(json).doesNotContain("confidence");
        assertThat(json).doesNotContain("drivers");
        assertThat(json).doesNotContain("worthPursuing");
    }

    @Test
    void unGiocatoreSconosciutoRisponde404InFormatoProblem() throws Exception {
        when(catalog.byId("ignoto")).thenReturn(Optional.empty());

        mvc.perform(get("/api/leagues/default/auctions/corrente/board/bidder/ignoto"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.type")
                        .value("https://fantaagent.local/problems/unknown-player"));
    }
}
