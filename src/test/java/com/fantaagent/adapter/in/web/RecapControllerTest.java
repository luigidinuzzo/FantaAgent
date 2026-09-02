package com.fantaagent.adapter.in.web;

import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.application.service.AuctionService;
import com.fantaagent.application.service.PlayerAnalysisService;
import com.fantaagent.application.service.PlayerSearchService;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.auction.AuctionProjector;
import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Player;
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
import java.util.Map;
import java.util.Optional;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
class RecapControllerTest {

    private static final LeagueRules RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static final List<Participant> PARTICIPANTS = List.of(
            new Participant("me", "Io", 'I', true),
            new Participant("marco", "Marco", 'M', false));

    private static final Player BASTONI = new Player("d1", "Bastoni", "Inter", Role.D, 20);

    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private AuctionService auctionService;

    @MockitoBean
    private PlayerAnalysisService analysisService;

    @MockitoBean
    private PlayerSearchService searchService;

    @MockitoBean
    private PlayerCatalog playerCatalog;

    @MockitoBean
    private com.fantaagent.application.service.AuctionRuntime auctionRuntime;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
        // Il riepilogo e' una schermata d'asta: senza un'asta scelta dalla home
        // rimanda alla home invece di indovinare su quale registro sta lavorando.
        when(auctionRuntime.hasAuction()).thenReturn(true);
        when(auctionService.participants()).thenReturn(PARTICIPANTS);
        when(playerCatalog.byId("d1")).thenReturn(Optional.of(BASTONI));
        when(auctionService.playerName(org.mockito.ArgumentMatchers.any()))
                .thenAnswer(inv -> {
                    com.fantaagent.domain.auction.Holding h = inv.getArgument(0);
                    return h.playerId().equals("d1") ? "Bastoni" : h.playerId();
                });
    }

    private static AuctionState stateWithOnePurchase() {
        return AuctionProjector.project(RULES, PARTICIPANTS, id -> Role.D,
                List.of(new AuctionEvent.PlayerPurchased(7L, Instant.now(), "d1", "marco", 47)));
    }

    @Test
    void showsOneColumnPerParticipantWithBudgetSlotsAndPlayersByRole() throws Exception {
        when(auctionService.state()).thenReturn(stateWithOnePurchase());

        mockMvc.perform(get("/riepilogo"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("Marco")))
                .andExpect(content().string(containsString("Bastoni")))
                .andExpect(content().string(containsString("47")));
    }

    /** Stesso endpoint di ogni altra pagina: un solo modo di costruire il file. */
    @Test
    void theRecapPageOffersTheRosterExport() throws Exception {
        when(auctionService.state()).thenReturn(stateWithOnePurchase());

        mockMvc.perform(get("/riepilogo"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("esporta rose")))
                .andExpect(content().string(containsString("/battitore/esporta")));
    }

    @Test
    void thePageLinksBackToTheAuctionPage() throws Exception {
        when(auctionService.state()).thenReturn(stateWithOnePurchase());

        // La schermata d'asta ora sta su /asta: "/" e' la home che chiede quale asta
        // aprire, e un link alla home non riporterebbe l'utente dove stava lavorando.
        mockMvc.perform(get("/riepilogo"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("href=\"/asta\"")));
    }

    @Test
    void revokingAPurchaseCallsTheServiceWithThatSpecificSeqAndReportsSuccess() throws Exception {
        doNothing().when(auctionService).revokePurchase(7L);
        when(auctionService.state()).thenReturn(
                AuctionProjector.project(RULES, PARTICIPANTS, id -> Role.D, List.of()));

        mockMvc.perform(post("/riepilogo/revoca").param("targetSeq", "7"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("rimosso")));

        verify(auctionService).revokePurchase(7L);
    }

    @Test
    void revokingAnUnknownSeqShowsTheRejectionMessageInsteadOfFailing() throws Exception {
        doThrow(new IllegalArgumentException("nessun acquisto con id 999"))
                .when(auctionService).revokePurchase(999L);
        when(auctionService.state()).thenReturn(stateWithOnePurchase());

        mockMvc.perform(post("/riepilogo/revoca").param("targetSeq", "999"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("nessun acquisto con id 999")))
                .andExpect(content().string(not(containsString("Exception"))));
    }
}
