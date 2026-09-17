package com.fantaagent.adapter.in.api;

import com.fantaagent.application.service.AuctionRuntime;
import com.fantaagent.application.service.AuctionSetup;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.AuctionSettingsHolder;
import com.fantaagent.config.AuctionSettingsStore;
import com.fantaagent.config.LeagueMembersSettingsStore;
import com.fantaagent.config.ScoringSettingsStore;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * I salvataggi che arrivano davvero a scrivere, con un {@link AuctionRuntime} finto: cosi'
 * le due modalita' — preparazione e asta aperta — si controllano senza dipendere da cosa
 * c'e' nell'archivio.
 */
@SpringBootTest
@ActiveProfiles("dev")
class SettingsApiCreationTest {

    private static final String URL = "/api/leagues/default/settings";

    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private AuctionRuntime runtime;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    void inPreparazioneCreaLAstaConRegolePartecipantiPunteggioEBattitore() throws Exception {
        when(runtime.hasAuction()).thenReturn(false);
        when(runtime.createNew(any(AuctionSetup.class))).thenReturn("2026-09-17");

        mvc.perform(put(URL).contentType(MediaType.APPLICATION_JSON)
                        .content(SettingsBodies.valid("Serata", 400, Map.of("P", 2, "D", 7, "C", 7, "A", 5))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.auctionId").value("2026-09-17"));

        ArgumentCaptor<AuctionSetup> captor = ArgumentCaptor.forClass(AuctionSetup.class);
        verify(runtime).createNew(captor.capture());
        assertThat(captor.getValue().name()).isEqualTo("Serata");
        assertThat(captor.getValue().rules().budget()).isEqualTo(400);
        assertThat(captor.getValue().rules().slots()).containsEntry(Role.D, 7);
        assertThat(captor.getValue().participants()).hasSize(2);
        assertThat(captor.getValue().bidder()).isEqualTo(new AuctionSettings(5, true));
        verify(runtime, never()).setParticipants(anyList());
        verify(runtime, never()).setBidder(any());
    }

    @Test
    void salvareNonScriveNessunFileGlobale() {
        // SettingsApi non dipende piu' dagli store globali: se tornasse a scriverli,
        // dovrebbe tornare a riceverli nel costruttore, e questo test lo vedrebbe.
        assertThat(SettingsApi.class.getConstructors()[0].getParameterTypes())
                .doesNotContain(ScoringSettingsStore.class, LeagueMembersSettingsStore.class,
                        AuctionSettingsStore.class, AuctionSettingsHolder.class);
    }

    @Test
    void adAstaApertaAggiornaNomiEBattitoreEIgnoraLeRegole() throws Exception {
        when(runtime.hasAuction()).thenReturn(true);
        when(runtime.participants()).thenReturn(SettingsBodies.PARTICIPANTS);

        mvc.perform(put(URL).contentType(MediaType.APPLICATION_JSON)
                        .content(SettingsBodies.valid("", 1, Map.of("P", 99, "D", 99, "C", 99, "A", 99))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.auctionId").doesNotExist());

        verify(runtime).setParticipants(anyList());
        verify(runtime).setBidder(any(AuctionSettings.class));
        verify(runtime, never()).createNew(any(AuctionSetup.class));
    }

    @Test
    void adAstaApertaUnPartecipanteInPiuVieneRifiutato() throws Exception {
        when(runtime.hasAuction()).thenReturn(true);
        when(runtime.participants()).thenReturn(SettingsBodies.PARTICIPANTS.subList(0, 1));

        mvc.perform(put(URL).contentType(MediaType.APPLICATION_JSON)
                        .content(SettingsBodies.valid("", 500, SettingsBodies.DEFAULT_SLOTS)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.participants[0]")
                        .value("Ad asta aperta non si aggiungono né si tolgono partecipanti."));
        verify(runtime, never()).setParticipants(anyList());
        verify(runtime, never()).setBidder(any());
    }
}
