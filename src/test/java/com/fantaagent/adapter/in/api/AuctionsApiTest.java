package com.fantaagent.adapter.in.api;

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

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
class AuctionsApiTest {

    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private AuctionRuntime runtime;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
        when(runtime.auctions()).thenReturn(List.of(
                new AuctionRuntime.AuctionSummary("2026-09-02", "Lega No Name",
                        Instant.parse("2026-09-02T13:08:41Z"), 3, Role.D, true),
                new AuctionRuntime.AuctionSummary("2025-08-30", null,
                        Instant.parse("2025-08-30T20:00:00Z"), 200, Role.A, false)));
    }

    @Test
    void elencaLeAsteConQuantoServeARiconoscerle() throws Exception {
        mvc.perform(get("/api/leagues/default/auctions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("2026-09-02"))
                .andExpect(jsonPath("$[0].label").value("Lega No Name"))
                .andExpect(jsonPath("$[0].purchases").value(3))
                .andExpect(jsonPath("$[0].phase").value("D"))
                .andExpect(jsonPath("$[0].selected").value(true))
                // I registri scritti prima che il nome esistesse ricadono sull'id:
                // mostrare una riga senza etichetta sarebbe mostrare un'asta anonima.
                .andExpect(jsonPath("$[1].label").value("2025-08-30"))
                .andExpect(jsonPath("$[1].selected").value(false));
    }

    @Test
    void selezionaUnAstaDiversaDaQuellaAperta() throws Exception {
        mvc.perform(post("/api/leagues/default/auctions/2025-08-30/select"))
                .andExpect(status().isNoContent());

        verify(runtime).select("2025-08-30");
    }

    @Test
    void unAstaInesistenteRisponde404InFormatoProblem() throws Exception {
        doThrow(new IllegalArgumentException("nessuna asta con identificativo inventata"))
                .when(runtime).select("inventata");

        mvc.perform(post("/api/leagues/default/auctions/inventata/select"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.type")
                        .value("https://fantaagent.local/problems/unknown-auction"));
    }

    @Test
    void chiudeLAstaAperta() throws Exception {
        mvc.perform(post("/api/leagues/default/auctions/current/leave"))
                .andExpect(status().isNoContent());

        verify(runtime).deselect();
    }

    /**
     * Selezionare l'asta gia' aperta e' uno stato ordinario della home, non un errore:
     * capita riaprendo la stessa scheda, o cliccando due volte "Riprendi" per distrazione.
     */
    @Test
    void selezionaUnAstaGiaAperta() throws Exception {
        mvc.perform(post("/api/leagues/default/auctions/2026-09-02/select"))
                .andExpect(status().isNoContent());

        verify(runtime).select("2026-09-02");
    }

    /**
     * Un archivio senza nessuna asta e' lo stato in cui la lega si trova prima della
     * prima serata: la home deve poterlo leggere come elenco vuoto, non come errore.
     */
    @Test
    void unArchivioVuotoTornaUnElencoVuoto() throws Exception {
        when(runtime.auctions()).thenReturn(List.of());

        mvc.perform(get("/api/leagues/default/auctions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$").isEmpty());
    }

    /**
     * {@code select} rilancia qualunque {@code IllegalArgumentException}, non solo
     * quella per un identificativo assente: {@link AuctionRuntime#select} chiama anche
     * {@code ValuationChain.build}, e un guasto di configurazione vero non deve
     * perdere la sua causa dietro il messaggio generico "asta sconosciuta".
     */
    @Test
    void unErroreDiversoDallIdentificativoNonPerdeLaCausa() throws Exception {
        IllegalArgumentException guasto =
                new IllegalArgumentException("catena di valutazione non costruibile");
        doThrow(guasto).when(runtime).select("2025-08-30");

        mvc.perform(post("/api/leagues/default/auctions/2025-08-30/select"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.type")
                        .value("https://fantaagent.local/problems/unknown-auction"));
    }
}
