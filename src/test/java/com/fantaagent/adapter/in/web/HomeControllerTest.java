package com.fantaagent.adapter.in.web;

import com.fantaagent.application.service.AuctionRuntime;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.time.Instant;
import java.util.List;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** La home che chiede quale asta aprire. */
@SpringBootTest
@ActiveProfiles("dev")
class HomeControllerTest {

    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private AuctionRuntime auctionRuntime;

    @MockitoBean
    private com.fantaagent.application.service.AuctionService auctionService;

    @MockitoBean
    private com.fantaagent.application.service.PlayerAnalysisService analysisService;

    @MockitoBean
    private com.fantaagent.application.service.PlayerSearchService searchService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    void elencaLeAsteConQuantoServeARiconoscerle() throws Exception {
        when(auctionRuntime.auctions()).thenReturn(List.of(
                new AuctionRuntime.AuctionSummary("2026-09-01", "Lega Brontolo",
                        Instant.parse("2026-09-01T08:41:00Z"), 25, Role.D, false)));

        mockMvc.perform(get("/"))
                .andExpect(status().isOk())
                // Il nome dato all'asta, e sotto l'identificativo: e' quest'ultimo il
                // nome della cartella su disco, ed e' cio' che si cerca andando a
                // guardare un registro a mano.
                .andExpect(content().string(containsString("Lega Brontolo")))
                .andExpect(content().string(containsString("2026-09-01")))
                .andExpect(content().string(containsString("25")))
                .andExpect(content().string(containsString(">D<")))
                .andExpect(content().string(containsString("riprendi")))
                .andExpect(content().string(containsString("nuova asta")));
    }

    @Test
    void riprendereSelezionaQuellAstaEApreLaSchermataDAsta() throws Exception {
        mockMvc.perform(post("/aste/riprendi").param("auctionId", "current"))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("/asta"));

        verify(auctionRuntime).select("current");
    }

    /**
     * "Nuova asta" porta alla preparazione e NON crea nulla. Prima creava la cartella
     * qui: chi tornava indietro dalla schermata di conferma lasciava un'asta vuota che
     * restava per sempre nell'elenco, e piu' d'una se ci ripensava piu' volte.
     */
    @Test
    void nuovaAstaPortaAllaPreparazioneSenzaCrearneAncoraUna() throws Exception {
        mockMvc.perform(post("/aste/nuova"))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("/impostazioni"));

        verify(auctionRuntime, org.mockito.Mockito.never())
                .createNew(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void laSchermataDAstaSenzaUnAstaSceltaRimandaAllaHome() throws Exception {
        when(auctionRuntime.hasAuction()).thenReturn(false);

        mockMvc.perform(get("/asta"))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("/"));
    }

    @Test
    void ilRiepilogoSenzaUnAstaSceltaRimandaAllaHome() throws Exception {
        when(auctionRuntime.hasAuction()).thenReturn(false);

        mockMvc.perform(get("/riepilogo"))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("/"));
    }
}
