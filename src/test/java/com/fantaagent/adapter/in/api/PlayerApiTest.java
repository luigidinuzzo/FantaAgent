package com.fantaagent.adapter.in.api;

import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.application.service.PlayerAnalysisService;
import com.fantaagent.application.service.PlayerSearchService;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.PlayerProjection;
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
import java.util.Optional;

import static org.hamcrest.Matchers.closeTo;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
class PlayerApiTest {

    private static final Player BASTONI = new Player("d1", "Bastoni", "Inter", Role.D, 20);
    private static final Player LAUTARO = new Player("a1", "Lautaro", "Inter", Role.A, 30);

    private static final PriceRecommendation RECOMMENDATION = new PriceRecommendation(
            "d1", 38, 47, 90, 9,
            "oltre 47 il completamento perde più di quanto guadagni",
            ConfidenceScore.of(0.9, 0.9, 0.6, 0.9),
            List.of(new Driver("budget", 3.0, "budget capiente")));

    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private PlayerSearchService search;

    @MockitoBean
    private PlayerAnalysisService analysis;

    @MockitoBean
    private PlayerCatalog catalog;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
        when(catalog.byId("d1")).thenReturn(Optional.of(BASTONI));
        when(search.search("bast", null)).thenReturn(List.of(BASTONI));
        when(analysis.analyze("d1")).thenReturn(RECOMMENDATION);
    }

    @Test
    void laRicercaRestituisceIGiocatoriConLaQuotazione() throws Exception {
        mvc.perform(get("/api/leagues/default/auctions/corrente/players?q=bast"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("d1"))
                .andExpect(jsonPath("$[0].name").value("Bastoni"))
                .andExpect(jsonPath("$[0].team").value("Inter"))
                .andExpect(jsonPath("$[0].role").value("D"))
                .andExpect(jsonPath("$[0].listPrice").value(20));
    }

    @Test
    void ilFiltroDiRuoloArrivaAlServizio() throws Exception {
        when(search.search("rossi", Role.A)).thenReturn(List.of(LAUTARO));

        mvc.perform(get("/api/leagues/default/auctions/corrente/players?q=rossi&role=A"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("a1"));

        verify(search).search("rossi", Role.A);
    }

    /**
     * Il modo di fallire del parametro che questo task introduce. Un ruolo inventato
     * non e' un caso di confine teorico: e' quello che arriva quando un frontend
     * costruisce l'URL da un valore che non ha validato. Deve uscire in problem+json
     * come ogni altro errore di questa API — verificato davvero, non dedotto dal
     * fatto che ApiExceptionHandler estende ResponseEntityExceptionHandler.
     */
    @Test
    void unRuoloInventatoEsceInProblemJson() throws Exception {
        mvc.perform(get("/api/leagues/default/auctions/corrente/players?q=ros&role=X"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.type")
                        .value("https://fantaagent.local/problems/invalid-path-variable"));
    }

    @Test
    void laValutazionePortaTettoMargineEDriver() throws Exception {
        mvc.perform(get("/api/leagues/default/auctions/corrente/players/d1/valuation"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.playerId").value("d1"))
                .andExpect(jsonPath("$.name").value("Bastoni"))
                .andExpect(jsonPath("$.team").value("Inter"))
                .andExpect(jsonPath("$.role").value("D"))
                .andExpect(jsonPath("$.maxBid").value(47))
                .andExpect(jsonPath("$.expectedPrice").value(38))
                .andExpect(jsonPath("$.hardCap").value(90))
                .andExpect(jsonPath("$.margin").value(9))
                .andExpect(jsonPath("$.walkAwayReason")
                        .value("oltre 47 il completamento perde più di quanto guadagni"))
                .andExpect(jsonPath("$.worthPursuing").value(true))
                .andExpect(jsonPath("$.confidenceStars").value(RECOMMENDATION.confidence().stars()))
                .andExpect(jsonPath("$.drivers[0].label").value("budget"));
    }

    @Test
    void ilGiocatoreSconosciutoRisponde404InFormatoProblem() throws Exception {
        when(catalog.byId("ignoto")).thenReturn(Optional.empty());

        mvc.perform(get("/api/leagues/default/auctions/corrente/players/ignoto/valuation"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.type")
                        .value("https://fantaagent.local/problems/unknown-player"));
    }

    @Test
    void laTabellaDiFasePortaOffsetETotale() throws Exception {
        // (playerId, role, expectedRating, bonusPerAppearance, expectedAppearances,
        //  basePoints, observedAppearances) — 30 presenze attese su 38 giornate
        //  danno una titolarita' di circa il 79%.
        PlayerProjection projection =
                new PlayerProjection("d1", Role.D, 6.2, 0.5, 30.0, 120.0, 25.0);
        when(search.phasePlayers(anyInt(), anyInt())).thenReturn(
                new PlayerSearchService.PhasePage(
                        List.of(new PlayerSearchService.PhaseRow(BASTONI, RECOMMENDATION, projection)),
                        0, 25, 1));

        mvc.perform(get("/api/leagues/default/auctions/corrente/players/phase?offset=0&limit=25"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.offset").value(0))
                .andExpect(jsonPath("$.total").value(1))
                // Ogni campo della riga, non solo id e maxBid: expectedPrice (38), margin (9),
                // listPrice (20), fantamediaAttesa (6.7) e titolaritaPercent (~78.95) sono
                // scelti tutti distinti fra loro apposta, cosi' una trasposizione fra due di
                // essi dentro PhaseRowView.from non potrebbe restare invisibile dietro un
                // valore che l'altro campo condivide.
                .andExpect(jsonPath("$.rows[0].id").value("d1"))
                .andExpect(jsonPath("$.rows[0].name").value("Bastoni"))
                .andExpect(jsonPath("$.rows[0].team").value("Inter"))
                .andExpect(jsonPath("$.rows[0].role").value("D"))
                .andExpect(jsonPath("$.rows[0].listPrice").value(20))
                .andExpect(jsonPath("$.rows[0].maxBid").value(47))
                .andExpect(jsonPath("$.rows[0].expectedPrice").value(38))
                .andExpect(jsonPath("$.rows[0].margin").value(9))
                .andExpect(jsonPath("$.rows[0].fantamediaAttesa").value(6.7))
                .andExpect(jsonPath("$.rows[0].titolaritaPercent",
                        closeTo(78.94736842105263, 0.0001)));
    }

    @Test
    void laTabellaDiFaseTagliaUnLimiteSopraIlTetto() throws Exception {
        when(search.phasePlayers(anyInt(), anyInt())).thenReturn(
                new PlayerSearchService.PhasePage(List.of(), 0, PlayerSearchService.PHASE_PAGE_SIZE, 0));

        mvc.perform(get("/api/leagues/default/auctions/corrente/players/phase?offset=0&limit=100000"))
                .andExpect(status().isOk());

        // Il tetto si verifica su cio' che il controller chiede al servizio, non solo su
        // cio' che torna: una risposta vuota supererebbe un'asserzione sul solo corpo anche
        // se il limite raggiungesse il servizio intatto.
        verify(search).phasePlayers(0, PlayerSearchService.PHASE_PAGE_SIZE);
    }
}
