package com.fantaagent.adapter.in.web;

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
import com.fantaagent.domain.strategy.ConfidenceScore;
import com.fantaagent.domain.strategy.Driver;
import com.fantaagent.domain.strategy.PriceRecommendation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
class AuctionControllerTest {

    private static final LeagueRules RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static final List<Participant> PARTICIPANTS = List.of(
            new Participant("me", "Io", 'I', true),
            new Participant("marco", "Marco", 'M', false));

    private static final Player BASTONI = new Player("d1", "Bastoni", "Inter", Role.D, 20);

    private static final PriceRecommendation RECOMMENDATION = new PriceRecommendation(
            "d1", 38, 47, 90, 9, "oltre 47 il completamento perde più di quanto guadagni",
            ConfidenceScore.of(0.9, 0.9, 0.6, 0.9),
            List.of(new Driver("Budget", 90, "hardCap 90"),
                    new Driver("Alternativa", 38, "Dimarco a ~38 rende il 94%"),
                    new Driver("Concorrenza", 47, "1 avversario cerca ancora un D")));

    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private AuctionService auctionService;

    @MockitoBean
    private PlayerAnalysisService analysisService;

    @MockitoBean
    private PlayerSearchService searchService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
        AuctionState state = AuctionProjector.project(RULES, PARTICIPANTS,
                id -> Role.D, List.of());
        when(auctionService.state()).thenReturn(state);
        when(auctionService.participants()).thenReturn(PARTICIPANTS);
        when(auctionService.me()).thenReturn(PARTICIPANTS.getFirst());
        when(auctionService.salesInCurrentPhase()).thenReturn(0);
        when(searchService.search(anyString())).thenReturn(List.of(BASTONI));
        when(analysisService.analyze("d1")).thenReturn(RECOMMENDATION);
    }

    @Test
    void servesTheAuctionPage() throws Exception {
        mockMvc.perform(get("/"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("FASE")));
    }

    @Test
    void searchingShowsTheTopResultWithItsNumbers() throws Exception {
        mockMvc.perform(get("/fragments/main").param("cmd", "bast"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Bastoni")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("47")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("38")));
    }

    @Test
    void aCommandWithAPriceRecordsAPurchaseForMe() throws Exception {
        mockMvc.perform(post("/command").param("cmd", "bast 47"))
                .andExpect(status().isOk());

        verify(auctionService).recordPurchase("d1", "me", 47);
    }

    @Test
    void aCommandWithAnInitialRecordsAPurchaseForThatParticipant() throws Exception {
        when(auctionService.byInitial('M')).thenReturn(Optional.of(PARTICIPANTS.get(1)));

        mockMvc.perform(post("/command").param("cmd", "bast 47 m"))
                .andExpect(status().isOk());

        verify(auctionService).recordPurchase("d1", "marco", 47);
    }

    @Test
    void aCommandWithoutAPriceOnlySearches() throws Exception {
        mockMvc.perform(post("/command").param("cmd", "bast"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Bastoni")));

        verify(auctionService, org.mockito.Mockito.never())
                .recordPurchase(anyString(), anyString(), anyInt());
    }

    @Test
    void aRejectedPurchaseIsShownAsAMessageNotAnError() throws Exception {
        org.mockito.Mockito.doThrow(new IllegalArgumentException("Bastoni è già stato acquistato"))
                .when(auctionService).recordPurchase(eq("d1"), anyString(), anyInt());

        mockMvc.perform(post("/command").param("cmd", "bast 47"))
                .andExpect(status().isOk())
                .andExpect(content().string(
                        org.hamcrest.Matchers.containsString("già stato acquistato")));
    }

    @Test
    void undoIsExposed() throws Exception {
        when(auctionService.undoLast()).thenReturn(true);

        mockMvc.perform(post("/undo")).andExpect(status().isOk());

        verify(auctionService).undoLast();
    }

    @Test
    void aSuccessfulPurchaseUpdatesTheBoardNotJustTheAnalysisPanel() throws Exception {
        // Simula lo stato dopo l'acquisto: budget di "me" sceso da 100 a 53 (100 - 47).
        // Un test che verificasse solo status 200 non avrebbe scoperto il difetto B,
        // per cui il tabellone restava indietro di un acquisto intero.
        AuctionState afterPurchase = AuctionProjector.project(RULES, PARTICIPANTS, id -> Role.D,
                List.of(new AuctionEvent.PlayerPurchased(1L, java.time.Instant.now(), "d1", "me", 47)));
        when(auctionService.state()).thenReturn(afterPurchase);

        mockMvc.perform(post("/command").param("cmd", "bast 47"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("53")));

        verify(auctionService).recordPurchase("d1", "me", 47);
    }

    @Test
    void theLiveSearchFragmentNeverContainsTheCommandInput() throws Exception {
        // #cmd deve vivere fuori dalla regione sostituita a ogni ricerca: se ricomparisse
        // qui, uno swap durante la digitazione lo svuoterebbe di nuovo (il difetto A).
        mockMvc.perform(get("/fragments/main").param("cmd", "bast"))
                .andExpect(status().isOk())
                .andExpect(content().string(
                        org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("id=\"cmd\""))));
    }
}
