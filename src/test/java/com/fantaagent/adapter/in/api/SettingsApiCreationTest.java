package com.fantaagent.adapter.in.api;

import com.fantaagent.application.service.AuctionRuntime;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.AuctionSettingsHolder;
import com.fantaagent.config.AuctionSettingsStore;
import com.fantaagent.config.LeagueMembersSettingsStore;
import com.fantaagent.config.ScoringSettingsStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * La nascita di un'asta al salvataggio, con {@link AuctionRuntime} finto: e' l'unico
 * modo per controllare le due modalita' (nessun'asta aperta / una gia' aperta) senza
 * dipendere da cosa l'archivio su disco contiene davvero, che e' invece cio' che
 * {@link SettingsApiTest} verifica con il runtime vero.
 *
 * <p>I tre store di configurazione sono finti anche loro, come in
 * {@code SettingsControllerTest}: store veri scriverebbero davvero nella data-dir del
 * progetto, lasciando file non tracciati dopo ogni esecuzione dei test.
 */
@SpringBootTest
@ActiveProfiles("dev")
class SettingsApiCreationTest {

    private static final String URL = "/api/leagues/default/settings";

    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private AuctionRuntime runtime;

    @MockitoBean
    private AuctionSettingsHolder auctionSettings;

    @MockitoBean
    private ScoringSettingsStore scoringStore;

    @MockitoBean
    private LeagueMembersSettingsStore membersStore;

    @MockitoBean
    private AuctionSettingsStore auctionStore;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
        when(auctionSettings.get()).thenReturn(new AuctionSettings(5, true));
    }

    @Test
    void senzaAstaApertaIlSalvataggioNeCreaUna() throws Exception {
        when(runtime.hasAuction()).thenReturn(false);
        when(runtime.createNew("Serata di prova")).thenReturn("2026-09-12");

        mvc.perform(put(URL).contentType(MediaType.APPLICATION_JSON)
                        .content(SettingsBodies.valid("Serata di prova", 5)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.auctionId").value("2026-09-12"));

        verify(runtime).createNew("Serata di prova");
    }

    /**
     * Ad asta aperta i parametri di punteggio non vengono nemmeno letti, e nessuna
     * seconda asta nasce: e' la semantica che SettingsController documenta, e questo
     * test e' cio' che impedisce all'API di divergerne.
     */
    @Test
    void conUnAstaApertaSalvaSenzaCrearneUnAltra() throws Exception {
        when(runtime.hasAuction()).thenReturn(true);

        mvc.perform(put(URL).contentType(MediaType.APPLICATION_JSON)
                        .content(SettingsBodies.valid("", 5)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.auctionId").doesNotExist());

        verify(runtime, never()).createNew(anyString());
        verify(runtime).setParticipants(org.mockito.ArgumentMatchers.anyList());
        verify(runtime).rebuild();
    }
}
