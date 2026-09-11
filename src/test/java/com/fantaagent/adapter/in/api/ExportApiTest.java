package com.fantaagent.adapter.in.api;

import com.fantaagent.application.service.AuctionService;
import com.fantaagent.domain.auction.AuctionState;
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

import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
class ExportApiTest {

    private static final LeagueRules RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static final List<Participant> PARTICIPANTS = List.of(
            new Participant("anna", "Anna", 'A', true),
            new Participant("bruno", "Bruno", 'B', false));

    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private AuctionService auction;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
        AuctionState state = new AuctionState(RULES, Role.P, "anna",
                Map.of("anna", new Squad("anna", List.of(), RULES),
                       "bruno", new Squad("bruno", List.of(), RULES)),
                List.of());
        when(auction.state()).thenReturn(state);
        when(auction.participants()).thenReturn(PARTICIPANTS);
        when(auction.auctionId()).thenReturn("2026-09-07");
    }

    @Test
    void esportaLeRoseInCsv() throws Exception {
        mvc.perform(get("/api/leagues/default/auctions/corrente/export.csv"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/csv"))
                .andExpect(header().string("Content-Disposition",
                        containsString("attachment")));
    }

    /**
     * Il nome del file porta l'id dell'asta: chi ne esporta tre in una sera si
     * ritroverebbe altrimenti tre "rose.csv" indistinguibili nella cartella dei
     * download.
     */
    @Test
    void ilNomeDelFilePortaLIdDellAsta() throws Exception {
        mvc.perform(get("/api/leagues/default/auctions/corrente/export.csv"))
                .andExpect(header().string("Content-Disposition",
                        containsString(auction.auctionId())));
    }
}
