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
                new AuctionRuntime.AuctionSummary("current",
                        Instant.parse("2026-09-01T08:41:00Z"), 25, Role.D, false)));

        mockMvc.perform(get("/"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("current")))
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

    @Test
    void nuovaAstaNeCreaUnaEPortaAlleImpostazioni() throws Exception {
        when(auctionRuntime.createNew()).thenReturn("2026-09-01");

        mockMvc.perform(post("/aste/nuova"))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("/impostazioni"));

        verify(auctionRuntime).createNew();
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
