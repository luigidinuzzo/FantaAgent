package com.fantaagent.adapter.in.api;

import com.fantaagent.application.service.AuctionRuntime;
import com.fantaagent.application.service.AuctionService;
import com.fantaagent.application.service.NoAuctionSelectedException;
import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.auction.Holding;
import com.fantaagent.domain.auction.Squad;
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

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
class AuctionStateApiTest {

    private static final LeagueRules RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 2, Role.C, 1, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static final List<Participant> PARTICIPANTS = List.of(
            new Participant("anna", "Anna", 'A', true),
            new Participant("bruno", "Bruno", 'B', false));

    private static final Holding BASTONI = new Holding(1, "d1", Role.D, "anna", 20);

    private static final AuctionState STATE = new AuctionState(RULES, Role.D, "anna",
            Map.of("anna", new Squad("anna", List.of(BASTONI), RULES),
                   "bruno", new Squad("bruno", List.of(), RULES)),
            List.of(BASTONI));

    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private AuctionService auction;

    @MockitoBean
    private AuctionRuntime runtime;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
        when(auction.state()).thenReturn(STATE);
        when(auction.participants()).thenReturn(PARTICIPANTS);
        when(auction.auctionId()).thenReturn("2026-09-07");
        when(auction.salesInCurrentPhase(STATE)).thenReturn(1);
        when(runtime.currentAuctionLabel()).thenReturn("Asta di prova");
    }

    @Test
    void statePortaFaseBudgetESlotDiOgniPartecipante() throws Exception {
        mvc.perform(get("/api/leagues/default/auctions/2026-09-07/state"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.auctionId").value("2026-09-07"))
                .andExpect(jsonPath("$.auctionName").value("Asta di prova"))
                .andExpect(jsonPath("$.currentPhase").value("D"))
                // ArrayList, non List.of: il fornitore JSON di com.jayway.jsonpath (json-smart)
                // risolve un mismatch di tipo provando a istanziare per riflessione la classe
                // ESATTA del valore atteso — riesce con ArrayList (costruttore pubblico), fallisce
                // in silenzio (torna null) con la ImmutableCollections$ListN di List.of, che non ne
                // ha uno. Stessi valori, stesso ordine: cambia solo il tipo concreto della lista.
                .andExpect(jsonPath("$.phases").value(new ArrayList<>(List.of("P", "D", "C", "A"))))
                .andExpect(jsonPath("$.soldInPhase").value(1))
                .andExpect(jsonPath("$.myParticipantId").value("anna"))
                .andExpect(jsonPath("$.canUndo").value(true))
                .andExpect(jsonPath("$.participants[0].id").value("anna"))
                .andExpect(jsonPath("$.participants[0].me").value(true))
                .andExpect(jsonPath("$.participants[0].budgetRemaining").value(80))
                .andExpect(jsonPath("$.participants[0].filledByRole.D").value(1))
                .andExpect(jsonPath("$.participants[0].slotsByRole.D").value(2))
                .andExpect(jsonPath("$.participants[1].budgetRemaining").value(100));
    }

    @Test
    void legaSconosciutaRisponde404InFormatoProblem() throws Exception {
        mvc.perform(get("/api/leagues/inesistente/auctions/2026-09-07/state"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.type")
                        .value("https://fantaagent.local/problems/unknown-league"));
    }

    /**
     * Il letterale riservato: il frontend non conosce nessun identificativo alla
     * prima richiesta — lo apprende proprio da questa risposta — e senza una via
     * d'ingresso non potrebbe formulare la chiamata che gliela porta.
     */
    @Test
    void ilLetteraleCorrenteApreLAstaAperta() throws Exception {
        mvc.perform(get("/api/leagues/default/auctions/corrente/state"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.auctionId").value("2026-09-07"));
    }

    /**
     * Prima di questo controllo il segmento era decorativo: qualunque valore
     * rispondeva con l'asta aperta, e /auctions/pippo/state dichiarava
     * allegramente auctionId "2026-09-07".
     */
    @Test
    void unAstaSconosciutaRisponde404InFormatoProblem() throws Exception {
        mvc.perform(get("/api/leagues/default/auctions/pippo/state"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.type")
                        .value("https://fantaagent.local/problems/unknown-auction"));
    }

    @Test
    void nessunaAstaSceltaRisponde409InFormatoProblem() throws Exception {
        when(auction.state()).thenThrow(new NoAuctionSelectedException());

        mvc.perform(get("/api/leagues/default/auctions/2026-09-07/state"))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.type")
                        .value("https://fantaagent.local/problems/no-auction-selected"));
    }
}
