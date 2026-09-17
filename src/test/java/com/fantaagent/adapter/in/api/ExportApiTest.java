package com.fantaagent.adapter.in.api;

import com.fantaagent.application.port.out.AuctionArchive;
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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
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

    @MockitoBean
    private AuctionArchive archive;

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
     * Il corpo, non solo l'intestazione: senza questa asserzione una regressione di
     * cablaggio (corpo vuoto, o {@code toCsv} chiamato sul soggetto sbagliato)
     * passerebbe inosservata — il test sopra guarda solo il tipo e l'header, mai cosa
     * c'e' davvero scritto dentro.
     */
    @Test
    void ilCorpoContieneLeRoseVere() throws Exception {
        mvc.perform(get("/api/leagues/default/auctions/corrente/export.csv"))
                .andExpect(content().string(containsString("$,$,$")));
    }

    /**
     * Il nome del file porta l'id dell'asta: chi ne esporta tre in una sera si
     * ritroverebbe altrimenti tre "rose.csv" indistinguibili nella cartella dei
     * download. Letterale, non {@code auction.auctionId()}: quella chiamata legge lo
     * stub appena impostato in {@link #setUp()}, cioe' la STESSA cosa che l'endpoint
     * legge — l'asserzione passerebbe qualunque cosa l'endpoint faccia con un id
     * diverso da quello del path (qui "corrente"), perche' confronterebbe il mock con
     * se stesso.
     */
    @Test
    void ilNomeDelFilePortaLIdDellAsta() throws Exception {
        mvc.perform(get("/api/leagues/default/auctions/corrente/export.csv"))
                .andExpect(header().string("Content-Disposition",
                        containsString("2026-09-07")));
    }

    /**
     * {@code AuctionGuard} promette che un sotto-progetto futuro rendera' le aste
     * indirizzabili per nome scelto da chi le crea — un id non piu' garantito essere
     * una data. Una virgoletta in quel nome, con la concatenazione letterale che
     * c'era prima, avrebbe rotto la stringa quotata dell'header: tutto cio' che segue
     * la virgoletta sarebbe stato letto come un secondo parametro invece che come
     * parte del nome file.
     *
     * <p>L'asserzione guarda l'header grezzo, non un giro di {@code
     * ContentDisposition.parse}: quel parser e' abbastanza tollerante da recuperare
     * il nome giusto anche dall'header rotto della concatenazione letterale, quindi
     * un confronto sul valore decodificato passerebbe con entrambe le versioni e non
     * proverebbe nulla. Il parametro esteso {@code filename*} (RFC 5987) e' invece
     * presente solo nella versione corretta: codifica la virgoletta come {@code %22}
     * invece di scriverla nuda dentro la stringa quotata, dove la chiuderebbe prima
     * del previsto.
     */
    @Test
    void ilNomeDelFileSopravviveAUnaVirgolettaNellIdDellAsta() throws Exception {
        when(auction.auctionId()).thenReturn("a\"b");

        String header = mvc.perform(get("/api/leagues/default/auctions/corrente/export.csv"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getHeader("Content-Disposition");

        assertThat(header).contains("filename*=UTF-8''rose-a%22b.csv");
    }

    /**
     * Stessa promessa dello stesso Javadoc, sul secondo modo in cui rompe: un nome
     * non-ASCII con la concatenazione letterale che c'era prima veniva scritto senza
     * dichiarare una codifica, lasciando decifrare i byte a chi apre il file — con
     * esiti diversi da programma a programma. {@code ContentDisposition.attachment()
     * .filename(..., UTF_8)} dichiara la codifica secondo RFC 5987/6266, percento-
     * codificando ogni byte non-ASCII nel parametro esteso {@code filename*}.
     */
    @Test
    void ilNomeDelFileSopravviveAUnNomeAccentato() throws Exception {
        when(auction.auctionId()).thenReturn("Serie città");

        String header = mvc.perform(get("/api/leagues/default/auctions/corrente/export.csv"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getHeader("Content-Disposition");

        assertThat(header).contains("filename*=UTF-8''rose-Serie%20citt%C3%A0.csv");
    }

    @Test
    void scaricareScriveAncheRoseCsvNellaCartellaDellAsta() throws Exception {
        MvcResult result = mvc.perform(get("/api/leagues/default/auctions/corrente/export.csv"))
                .andExpect(status().isOk()).andReturn();
        verify(archive).saveExport(eq("2026-09-07"),
                eq(result.getResponse().getContentAsString(StandardCharsets.UTF_8)));
    }

    @Test
    void seLaScritturaSuDiscoFallisceIlDownloadParteComunque() throws Exception {
        doThrow(new UncheckedIOException(new IOException("disco pieno")))
                .when(archive).saveExport(anyString(), anyString());
        mvc.perform(get("/api/leagues/default/auctions/corrente/export.csv"))
                .andExpect(status().isOk());
    }
}
