package com.fantaagent.adapter.in.api;

import com.fantaagent.domain.player.Role;
import com.fantaagent.testsupport.AuctionApiFixture;
import com.fantaagent.testsupport.TestCatalogConfig;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.web.context.WebApplicationContext;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
@Import(TestCatalogConfig.class)
@TestPropertySource(properties = "fantaagent.data-dir=target/test-data-api-write")
class AuctionWriteApiTest {

    static final String PROBLEMS = "https://fantaagent.local/problems/";

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private JdbcClient jdbc;

    private AuctionApiFixture f;

    @BeforeEach
    void setUp() throws Exception {
        f = AuctionApiFixture.create(context);
    }

    private ResultActions buy(Cookie who, String playerId, String buyerId, int price, String requestId) throws Exception {
        return f.mvc.perform(post(f.url("/purchases")).with(csrf()).cookie(who)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"requestId\":\"%s\",\"playerId\":\"%s\",\"participantId\":\"%s\",\"price\":%d}"
                        .formatted(requestId, playerId, buyerId, price)));
    }

    @Test
    void lAmministratoreRegistraEFirma() throws Exception {
        String seq = buy(f.anna, f.player(Role.P, 0), f.brunoId, 12, "r-1")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.participantId").value(f.brunoId))
                .andReturn().getResponse().getContentAsString();
        long written = ((Number) JsonPath.read(seq, "$.seq")).longValue();

        UUID actor = jdbc.sql("SELECT actor_id FROM auction_event WHERE auction_id = :a AND seq = :s")
                .param("a", UUID.fromString(f.auctionId)).param("s", written).query(UUID.class).single();
        assertThat(actor.toString()).isEqualTo(f.annaId);
    }

    @Test
    void unMembroNonScriveNiente() throws Exception {
        buy(f.bruno, f.player(Role.P, 0), f.brunoId, 12, "r-1")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "admin-only"));
        f.mvc.perform(post(f.url("/purchases/void-last")).with(csrf()).cookie(f.bruno))
                .andExpect(status().isForbidden());
        f.mvc.perform(post(f.url("/purchases/2/void")).with(csrf()).cookie(f.bruno))
                .andExpect(status().isForbidden());
        f.mvc.perform(post(f.url("/purchases/2/correct")).with(csrf()).cookie(f.bruno)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"participantId\":\"%s\",\"price\":5}".formatted(f.brunoId)))
                .andExpect(status().isForbidden());
        f.mvc.perform(post(f.url("/phase")).with(csrf()).cookie(f.bruno)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"D\"}"))
                .andExpect(status().isForbidden());
        f.mvc.perform(get(f.url("/state")).cookie(f.bruno)).andExpect(jsonPath("$.version").value(1));
    }

    @Test
    void laStessaRichiestaDueVolteEUnAcquistoSolo() throws Exception {
        String p = f.player(Role.P, 0);
        buy(f.anna, p, f.brunoId, 12, "r-1").andExpect(status().isCreated());
        buy(f.anna, p, f.brunoId, 12, "r-1").andExpect(status().isCreated());
        f.mvc.perform(get(f.url("/state")).cookie(f.anna)).andExpect(jsonPath("$.version").value(2));
    }

    @Test
    void unPostoCheNonEsisteNonCompra() throws Exception {
        buy(f.anna, f.player(Role.P, 0), UUID.randomUUID().toString(), 12, "r-1")
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void ilGiocatoreGiaVendutoDaUn409Tipizzato() throws Exception {
        String p = f.player(Role.P, 0);
        buy(f.anna, p, f.brunoId, 12, "r-1").andExpect(status().isCreated());
        buy(f.anna, p, f.carlaId, 12, "r-2")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "player-already-sold"));
    }

    @Test
    void ilBudgetInsufficienteDaUn422Tipizzato() throws Exception {
        buy(f.anna, f.player(Role.P, 0), f.brunoId, 501, "r-1")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "insufficient-budget"));
    }

    /** Il regolamento sintetico ({@link com.fantaagent.testsupport.Fixtures#template()}) prevede 3 slot P. */
    @Test
    void gliSlotDiRuoloEsauritiDannoUn422Tipizzato() throws Exception {
        buy(f.anna, f.player(Role.P, 0), f.brunoId, 10, "rp-1").andExpect(status().isCreated());
        buy(f.anna, f.player(Role.P, 1), f.brunoId, 10, "rp-2").andExpect(status().isCreated());
        buy(f.anna, f.player(Role.P, 2), f.brunoId, 10, "rp-3").andExpect(status().isCreated());
        buy(f.anna, f.player(Role.P, 3), f.brunoId, 10, "rp-4")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "role-slots-exhausted"));
    }

    /**
     * La chiave di idempotenza guarda solo se e' gia' stata usata: un secondo
     * invio con un prezzo diverso non scrive un secondo evento, e la risposta
     * riporta il prezzo registrato la prima volta, non quello appena inviato.
     */
    @Test
    void ilRinvioConUnPrezzoDiversoRiportaIlPrimoRegistrato() throws Exception {
        String p = f.player(Role.P, 0);
        buy(f.anna, p, f.brunoId, 12, "r-dup")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.price").value(12));
        buy(f.anna, p, f.brunoId, 50, "r-dup")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.price").value(12));
        f.mvc.perform(get(f.url("/state")).cookie(f.anna)).andExpect(jsonPath("$.version").value(2));
    }

    @Test
    void annullareDueVolteDa409EUnIdInesistenteDa404() throws Exception {
        String body = buy(f.anna, f.player(Role.P, 0), f.brunoId, 12, "r-1")
                .andReturn().getResponse().getContentAsString();
        long seq = ((Number) JsonPath.read(body, "$.seq")).longValue();

        f.mvc.perform(post(f.url("/purchases/" + seq + "/void")).with(csrf()).cookie(f.anna))
                .andExpect(status().isNoContent());
        f.mvc.perform(post(f.url("/purchases/" + seq + "/void")).with(csrf()).cookie(f.anna))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "purchase-already-revoked"));
        f.mvc.perform(post(f.url("/purchases/999999/void")).with(csrf()).cookie(f.anna))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "purchase-not-found"));
    }

    @Test
    void laCorrezioneSpostaIlGiocatore() throws Exception {
        String body = buy(f.anna, f.player(Role.P, 0), f.brunoId, 12, "r-1")
                .andReturn().getResponse().getContentAsString();
        long seq = ((Number) JsonPath.read(body, "$.seq")).longValue();

        f.mvc.perform(post(f.url("/purchases/" + seq + "/correct")).with(csrf()).cookie(f.anna)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"participantId\":\"%s\",\"price\":20}".formatted(f.carlaId)))
                .andExpect(status().isNoContent());

        f.mvc.perform(get(f.url("/state")).cookie(f.anna))
                .andExpect(jsonPath("$.participants[?(@.id == '%s')].budgetRemaining".formatted(f.carlaId)).value(480))
                .andExpect(jsonPath("$.participants[?(@.id == '%s')].budgetRemaining".formatted(f.brunoId)).value(500));
    }

    @Test
    void dueAcquistiNelloStessoIstantePassanoEntrambi() throws Exception {
        CompletableFuture<Integer> a = CompletableFuture.supplyAsync(() -> postStatus(f.player(Role.D, 0), f.brunoId));
        CompletableFuture<Integer> b = CompletableFuture.supplyAsync(() -> postStatus(f.player(Role.D, 1), f.carlaId));
        assertThat(a.get()).isEqualTo(201);
        assertThat(b.get()).isEqualTo(201);
        f.mvc.perform(get(f.url("/state")).cookie(f.anna)).andExpect(jsonPath("$.version").value(3));
    }

    private int postStatus(String playerId, String buyerId) {
        try {
            return buy(f.anna, playerId, buyerId, 5, UUID.randomUUID().toString())
                    .andReturn().getResponse().getStatus();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @Test
    void faseEAnnullamentiPerLAmministratore() throws Exception {
        buy(f.anna, f.player(Role.P, 0), f.brunoId, 12, "r-1");
        f.mvc.perform(post(f.url("/purchases/void-last")).with(csrf()).cookie(f.anna))
                .andExpect(status().isNoContent());
        f.mvc.perform(post(f.url("/purchases/void-last")).with(csrf()).cookie(f.anna))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "nothing-to-undo"));
        f.mvc.perform(post(f.url("/phase")).with(csrf()).cookie(f.anna)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"D\"}"))
                .andExpect(status().isNoContent());
        f.mvc.perform(get(f.url("/state")).cookie(f.carla)).andExpect(jsonPath("$.currentPhase").value("D"));
    }
}
