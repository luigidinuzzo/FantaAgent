package com.fantaagent.adapter.in.api.board;

import com.fantaagent.application.service.AuctionService;
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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
class BoardApiTest {

    private static final LeagueRules RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 2, Role.C, 1, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static final Holding BASTONI = new Holding(1, "d1", Role.D, "anna", 47);

    private static final AuctionState STATE = new AuctionState(RULES, Role.D, "anna",
            Map.of("anna", new Squad("anna", List.of(BASTONI), RULES),
                   "bruno", new Squad("bruno", List.of(), RULES)),
            List.of(BASTONI));

    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private AuctionService auction;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
        when(auction.state()).thenReturn(STATE);
        when(auction.auctionId()).thenReturn("a1");
        when(auction.participants()).thenReturn(List.of(
                new Participant("anna", "Anna", 'A', true),
                new Participant("bruno", "Bruno", 'B', false)));
        when(auction.playerName(BASTONI)).thenReturn("Bastoni");
    }

    @Test
    void portaLeRoseConIPrezziPagati() throws Exception {
        mvc.perform(get("/api/leagues/default/auctions/corrente/board"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.columns[0].participantName").value("Anna"))
                .andExpect(jsonPath("$.columns[0].budgetRemaining").value(53))
                .andExpect(jsonPath("$.columns[0].slotsRemaining").value(4))
                .andExpect(jsonPath("$.columns[0].byRole.D[0].playerName").value("Bastoni"))
                .andExpect(jsonPath("$.columns[0].byRole.D[0].price").value(47))
                .andExpect(jsonPath("$.columns[1].participantName").value("Bruno"))
                .andExpect(jsonPath("$.columns[1].budgetRemaining").value(100))
                .andExpect(jsonPath("$.columns[1].slotsRemaining").value(5))
                .andExpect(jsonPath("$.columns[1].byRole.D").isEmpty());
    }

    /**
     * Il vincolo strutturale, verificato sul corpo vero e non sul tipo Java: se
     * un giorno qualcuno aggiungesse un campo di valutazione a un DTO del
     * tabellone, questo test lo vedrebbe uscire dal filo.
     */
    @Test
    void nonContieneNessunaParolaDelVocabolarioDelleValutazioni() throws Exception {
        MvcResult result = mvc.perform(get("/api/leagues/default/auctions/corrente/board"))
                .andExpect(status().isOk())
                .andReturn();

        String json = result.getResponse().getContentAsString(StandardCharsets.UTF_8);

        assertThat(json).doesNotContain("maxBid");
        assertThat(json).doesNotContain("expectedPrice");
        assertThat(json).doesNotContain("margin");
        assertThat(json).doesNotContain("hardCap");
        assertThat(json).doesNotContain("walkAway");
        assertThat(json).doesNotContain("confidence");
        assertThat(json).doesNotContain("drivers");
        assertThat(json).doesNotContain("worthPursuing");
    }
}
