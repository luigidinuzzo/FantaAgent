package com.fantaagent.adapter.in.api.importing;

import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.testsupport.AuctionApiFixture;
import com.fantaagent.testsupport.OldAuctionFiles;
import com.fantaagent.testsupport.TestCatalogConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.web.context.WebApplicationContext;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
@Import(TestCatalogConfig.class)
@TestPropertySource(properties = "fantaagent.data-dir=target/test-data-import-api")
class ImportApiTest {

    static final String PROBLEMS = "https://fantaagent.local/problems/";

    @Autowired
    private WebApplicationContext context;

    @TempDir
    Path dir;

    private AuctionApiFixture f;
    private Map<String, byte[]> files;

    @BeforeEach
    void setUp() throws Exception {
        f = AuctionApiFixture.create(context);
        Instant at = Instant.parse("2025-08-30T20:00:00Z");
        files = OldAuctionFiles.write(dir, List.of(
                        new Participant("me", "Io", 'I', true), new Participant("p2", "Marco", 'M', false)),
                List.of(new AuctionEvent.AuctionStarted(1, at, "Asta del 2025"),
                        new AuctionEvent.PlayerPurchased(2, at, f.player(com.fantaagent.domain.player.Role.P, 0), "p2", 45)));
    }

    private MockMultipartHttpServletRequestBuilder upload(String path) {
        MockMultipartHttpServletRequestBuilder builder = multipart("/api/leagues/" + f.leagueId + path);
        files.forEach((name, bytes) -> builder.file(new MockMultipartFile("files", name, "application/octet-stream", bytes)));
        return builder;
    }

    @Test
    void ilRiepilogoEPoiLImportazione() throws Exception {
        f.mvc.perform(upload("/imports/preview").with(csrf()).cookie(f.anna))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Asta del 2025"))
                .andExpect(jsonPath("$.participants[1].name").value("Marco"));

        MockMultipartFile mapping = new MockMultipartFile("mapping", "", MediaType.APPLICATION_JSON_VALUE,
                "{\"me\":\"%s\",\"p2\":\"%s\"}".formatted(f.annaId, f.brunoId).getBytes(StandardCharsets.UTF_8));
        f.mvc.perform(upload("/imports").file(mapping).with(csrf()).cookie(f.anna))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.auctionId").exists());

        f.mvc.perform(get("/api/leagues/" + f.leagueId + "/auctions").cookie(f.bruno))
                .andExpect(jsonPath("$[?(@.name == 'Asta del 2025')].myBudgetRemaining").value(455));
    }

    @Test
    void unMembroNonImporta() throws Exception {
        f.mvc.perform(upload("/imports/preview").with(csrf()).cookie(f.bruno))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "admin-only"));
    }

    @Test
    void unAbbinamentoIncompletoEDettoPerCampo() throws Exception {
        MockMultipartFile mapping = new MockMultipartFile("mapping", "", MediaType.APPLICATION_JSON_VALUE,
                "{\"me\":\"%s\"}".formatted(f.annaId).getBytes(StandardCharsets.UTF_8));
        f.mvc.perform(upload("/imports").file(mapping).with(csrf()).cookie(f.anna))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "invalid-import"))
                .andExpect(jsonPath("$.errors.mapping").isArray());
    }
}
