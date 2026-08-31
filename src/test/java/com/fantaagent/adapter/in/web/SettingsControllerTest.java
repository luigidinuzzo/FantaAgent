package com.fantaagent.adapter.in.web;

import com.fantaagent.application.service.AuctionService;
import com.fantaagent.config.LeagueMembersSettingsStore;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.auction.AuctionProjector;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
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

import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Sezione PARTECIPANTI della schermata Impostazioni: modifica dei nomi senza toccare
 * gli id, che il registro dell'asta usa per attribuire gli acquisti.
 */
@SpringBootTest
@ActiveProfiles("dev")
class SettingsControllerTest {

    private static final LeagueRules RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static final List<Participant> PARTICIPANTS = List.of(
            new Participant("me", "Io", 'I', true),
            new Participant("marco", "Marco", 'M', false));

    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private AuctionService auctionService;

    @MockitoBean
    private LeagueMembersSettingsStore membersStore;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
        when(membersStore.file()).thenReturn(Path.of("res/league-members.yml"));
        when(membersStore.load()).thenReturn(Optional.empty());
        when(auctionService.state()).thenReturn(
                AuctionProjector.project(RULES, PARTICIPANTS, id -> Role.D, List.of()));
    }

    @Test
    void savingPersistsTheNewNamesWithTheSameIds() throws Exception {
        mockMvc.perform(post("/impostazioni/partecipanti")
                        .param("id", "me", "marco")
                        .param("name", "Gigi", "Marco")
                        .param("initial", "I", "M")
                        .param("me", "me"))
                .andExpect(status().isOk());

        verify(membersStore).save(List.of(
                new Participant("me", "Gigi", 'I', true),
                new Participant("marco", "Marco", 'M', false)));
    }

    @Test
    void duplicateInitialsAreRejectedNamingTheClash() throws Exception {
        mockMvc.perform(post("/impostazioni/partecipanti")
                        .param("id", "me", "marco")
                        .param("name", "Io", "Marco")
                        .param("initial", "M", "M")
                        .param("me", "me"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("iniziale")));

        verify(membersStore, never()).save(any());
    }

    @Test
    void editingIsRefusedOncePurchasesExist() throws Exception {
        when(auctionService.state()).thenReturn(AuctionProjector.project(RULES, PARTICIPANTS,
                id -> Role.D,
                List.of(new AuctionEvent.PlayerPurchased(1, Instant.now(), "d1", "me", 20))));

        mockMvc.perform(post("/impostazioni/partecipanti")
                        .param("id", "me", "marco")
                        .param("name", "Gigi", "Marco")
                        .param("initial", "I", "M")
                        .param("me", "me"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("già iniziata")));

        verify(membersStore, never()).save(any());
    }
}
