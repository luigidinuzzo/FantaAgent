package com.fantaagent.adapter.in.api;

import com.fantaagent.application.service.AuctionService;
import com.fantaagent.domain.player.Role;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
class PhaseAndVoidApiTest {

    private static final String BASE = "/api/leagues/default/auctions/corrente";

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
    void annullaUnAcquistoPreciso() throws Exception {
        mvc.perform(post(BASE + "/purchases/7/void"))
                .andExpect(status().isNoContent());

        verify(auction).revokePurchase(7L);
    }

    @Test
    void annullaLUltimo() throws Exception {
        when(auction.undoLast()).thenReturn(true);

        mvc.perform(post(BASE + "/purchases/void-last"))
                .andExpect(status().isNoContent());
    }

    @Test
    void nienteDaAnnullareDaUn409Tipizzato() throws Exception {
        when(auction.undoLast()).thenReturn(false);

        mvc.perform(post(BASE + "/purchases/void-last"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type")
                        .value("https://fantaagent.local/problems/nothing-to-undo"));
    }

    @Test
    void cambiaFase() throws Exception {
        when(auction.selectPhase(Role.C)).thenReturn(true);

        mvc.perform(post(BASE + "/phase").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"C\"}"))
                .andExpect(status().isNoContent());

        verify(auction).selectPhase(Role.C);
    }
}
