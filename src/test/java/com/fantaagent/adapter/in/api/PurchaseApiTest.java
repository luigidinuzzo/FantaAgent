package com.fantaagent.adapter.in.api;

import com.fantaagent.application.service.AuctionService;
import com.fantaagent.application.service.PurchaseRejectedException;
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

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
class PurchaseApiTest {

    private static final String URL = "/api/leagues/default/auctions/a1/purchases";

    private static final String BODY = """
            {"requestId":"req-1","playerId":"d1","participantId":"anna","price":47}
            """;

    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private AuctionService auction;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    void aggiudicaEPortaIlSeqScritto() throws Exception {
        when(auction.recordPurchase("d1", "anna", 47, "req-1")).thenReturn(7L);

        mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.seq").value(7))
                .andExpect(jsonPath("$.playerId").value("d1"))
                .andExpect(jsonPath("$.price").value(47));

        verify(auction).recordPurchase("d1", "anna", 47, "req-1");
    }

    @Test
    void ilGiocatoreGiaVendutoDaUn409Tipizzato() throws Exception {
        when(auction.recordPurchase("d1", "anna", 47, "req-1"))
                .thenThrow(new PurchaseRejectedException(
                        PurchaseRejectedException.Reason.ALREADY_SOLD,
                        "Bastoni è già stato acquistato"));

        mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.type")
                        .value("https://fantaagent.local/problems/player-already-sold"))
                .andExpect(jsonPath("$.detail").value("Bastoni è già stato acquistato"));
    }

    @Test
    void ilBudgetInsufficienteDaUn422Tipizzato() throws Exception {
        when(auction.recordPurchase("d1", "anna", 47, "req-1"))
                .thenThrow(new PurchaseRejectedException(
                        PurchaseRejectedException.Reason.INSUFFICIENT_BUDGET,
                        "Anna ha solo 12 crediti di budget residuo"));

        mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.type")
                        .value("https://fantaagent.local/problems/insufficient-budget"));
    }

    @Test
    void laChiaveDiIdempotenzaEObbligatoria() throws Exception {
        mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"playerId":"d1","participantId":"anna","price":47}
                                """))
                .andExpect(status().isBadRequest());
    }
}
