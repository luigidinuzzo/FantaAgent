package com.fantaagent.adapter.in.web;

import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.application.service.AuctionService;
import com.fantaagent.application.service.PlayerAnalysisService;
import com.fantaagent.application.service.PlayerSearchService;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.auction.AuctionProjector;
import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Player;
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
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
class AuctionControllerTest {

    private static final LeagueRules RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static final List<Participant> PARTICIPANTS = List.of(
            new Participant("me", "Io", 'I', true),
            new Participant("marco", "Marco", 'M', false));

    private static final Player BASTONI = new Player("d1", "Bastoni", "Inter", Role.D, 20);

    private static final PriceRecommendation RECOMMENDATION = new PriceRecommendation(
            "d1", 38, 47, 90, 9, "oltre 47 il completamento perde più di quanto guadagni",
            ConfidenceScore.of(0.9, 0.9, 0.6, 0.9),
            List.of(new Driver("Budget", 90, "hardCap 90"),
                    new Driver("Alternativa", 38, "Dimarco a ~38 rende il 94%"),
                    new Driver("Concorrenza", 47, "1 avversario cerca ancora un D")));

    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private AuctionService auctionService;

    @MockitoBean
    private PlayerAnalysisService analysisService;

    @MockitoBean
    private PlayerSearchService searchService;

    @MockitoBean
    private PlayerCatalog playerCatalog;

    @MockitoBean
    private com.fantaagent.application.service.AuctionRuntime auctionRuntime;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
        // Un'asta scelta dalla home: senza, /asta rimanda indietro invece di indovinare.
        when(auctionRuntime.hasAuction()).thenReturn(true);
        AuctionState state = AuctionProjector.project(RULES, PARTICIPANTS,
                id -> Role.D, List.of());
        when(auctionService.state()).thenReturn(state);
        when(auctionService.participants()).thenReturn(PARTICIPANTS);
        when(auctionService.me()).thenReturn(PARTICIPANTS.getFirst());
        when(auctionService.salesInCurrentPhase()).thenReturn(0);
        when(searchService.search(anyString())).thenReturn(List.of(BASTONI));
        when(analysisService.analyze("d1")).thenReturn(RECOMMENDATION);
        when(playerCatalog.byId("d1")).thenReturn(Optional.of(BASTONI));
    }

    /**
     * Il popup porta con se' il max bid e la durata del countdown: sono i due valori da
     * cui bidder.js parte, e viaggiano come data-* sul dialog. Se sparissero, il timer
     * ricadrebbe sul default e il tetto non verrebbe mai segnalato — un popup che si
     * apre e sembra funzionare, ma che ha perso la sola informazione per cui esiste.
     */
    @Test
    void ilBattitorePortaMaxBidEdurataDelCountdown() throws Exception {
        mockMvc.perform(get("/asta/battitore").param("playerId", "d1"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Bastoni")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("data-max-bid=\"47\"")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        "data-seconds=\"" + AuctionSettings.DEFAULTS.bidTimerSeconds() + "\"")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("bidderAssign")));
    }

    /** La tendina dell'aggiudicazione deve elencare tutti i partecipanti, non solo me. */
    @Test
    void ilBattitoreElencaTuttiIpartecipanti() throws Exception {
        mockMvc.perform(get("/asta/battitore").param("playerId", "d1"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Marco")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Io")));
    }

    /**
     * Aprire il battitore non registra nulla: il countdown e i rilanci vivono nel
     * browser, e il registro si tocca solo all'aggiudicazione. Se questo test cadesse,
     * ogni popup aperto per curiosita' lascerebbe un evento nel log dell'asta.
     */
    @Test
    void aprireIlBattitoreNonRegistraAlcunAcquisto() throws Exception {
        mockMvc.perform(get("/asta/battitore").param("playerId", "d1"))
                .andExpect(status().isOk());

        verify(auctionService, org.mockito.Mockito.never())
                .recordPurchase(anyString(), anyString(), anyInt());
    }

    /**
     * Un id sconosciuto non deve produrre un popup vuoto ne' un errore 500: restituisce
     * corpo vuoto, e il punto di innesto resta com'era.
     */
    @Test
    void unGiocatoreInesistenteNonApreAlcunPopup() throws Exception {
        when(playerCatalog.byId("ignoto")).thenReturn(Optional.empty());

        mockMvc.perform(get("/asta/battitore").param("playerId", "ignoto"))
                .andExpect(status().isOk())
                .andExpect(content().string(
                        org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("bidderDialog"))));
    }

    @Test
    void servesTheAuctionPage() throws Exception {
        mockMvc.perform(get("/asta"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("FASE")));
    }

    @Test
    void searchingShowsTheTopResultWithItsNumbers() throws Exception {
        mockMvc.perform(get("/fragments/main").param("cmd", "bast"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Bastoni")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("47")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("38")));
    }

    @Test
    void aCommandWithAPriceRecordsAPurchaseForMe() throws Exception {
        mockMvc.perform(post("/command").param("cmd", "bast 47"))
                .andExpect(status().isOk());

        verify(auctionService).recordPurchase("d1", "me", 47);
    }

    @Test
    void aCommandWithAnInitialRecordsAPurchaseForThatParticipant() throws Exception {
        when(auctionService.byInitial('M')).thenReturn(Optional.of(PARTICIPANTS.get(1)));

        mockMvc.perform(post("/command").param("cmd", "bast 47 m"))
                .andExpect(status().isOk());

        verify(auctionService).recordPurchase("d1", "marco", 47);
    }

    @Test
    void aCommandWithoutAPriceOnlySearches() throws Exception {
        mockMvc.perform(post("/command").param("cmd", "bast"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Bastoni")));

        verify(auctionService, org.mockito.Mockito.never())
                .recordPurchase(anyString(), anyString(), anyInt());
    }

    @Test
    void aRejectedPurchaseIsShownAsAMessageNotAnError() throws Exception {
        org.mockito.Mockito.doThrow(new IllegalArgumentException("Bastoni è già stato acquistato"))
                .when(auctionService).recordPurchase(eq("d1"), anyString(), anyInt());

        mockMvc.perform(post("/command").param("cmd", "bast 47"))
                .andExpect(status().isOk())
                .andExpect(content().string(
                        org.hamcrest.Matchers.containsString("già stato acquistato")));
    }

    @Test
    void aSuccessfulPurchaseTellsPhaseTableToRefreshItself() throws Exception {
        mockMvc.perform(post("/command").param("cmd", "bast 47"))
                .andExpect(status().isOk())
                .andExpect(header().string("HX-Trigger", "fantaStateChanged"));
    }

    @Test
    void aRejectedPurchaseDoesNotTriggerAPhaseTableRefresh() throws Exception {
        org.mockito.Mockito.doThrow(new IllegalArgumentException("Bastoni è già stato acquistato"))
                .when(auctionService).recordPurchase(eq("d1"), anyString(), anyInt());

        mockMvc.perform(post("/command").param("cmd", "bast 47"))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist("HX-Trigger"));
    }

    @Test
    void assignRecordsAPurchaseForTheChosenParticipantAtTheEnteredPrice() throws Exception {
        mockMvc.perform(post("/assign")
                        .param("playerId", "d1")
                        .param("participantId", "marco")
                        .param("price", "47"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Bastoni")));

        verify(auctionService).recordPurchase("d1", "marco", 47);
    }

    @Test
    void aRejectedAssignmentIsShownAsTheSameItalianToastMessage() throws Exception {
        org.mockito.Mockito.doThrow(new IllegalArgumentException("Bastoni è già stato acquistato"))
                .when(auctionService).recordPurchase(eq("d1"), anyString(), anyInt());

        mockMvc.perform(post("/assign")
                        .param("playerId", "d1")
                        .param("participantId", "marco")
                        .param("price", "47"))
                .andExpect(status().isOk())
                .andExpect(content().string(
                        org.hamcrest.Matchers.containsString("già stato acquistato")));
    }

    @Test
    void aSuccessfulAssignmentTellsPhaseTableToRefreshItself() throws Exception {
        mockMvc.perform(post("/assign")
                        .param("playerId", "d1")
                        .param("participantId", "marco")
                        .param("price", "47"))
                .andExpect(status().isOk())
                .andExpect(header().string("HX-Trigger", "fantaStateChanged"));
    }

    @Test
    void aRejectedAssignmentDoesNotTriggerAPhaseTableRefresh() throws Exception {
        org.mockito.Mockito.doThrow(new IllegalArgumentException("Bastoni è già stato acquistato"))
                .when(auctionService).recordPurchase(eq("d1"), anyString(), anyInt());

        mockMvc.perform(post("/assign")
                        .param("playerId", "d1")
                        .param("participantId", "marco")
                        .param("price", "47"))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist("HX-Trigger"));
    }

    @Test
    void selectingAPhaseAsksTheServiceForThatExactRoleAndRefreshesTheTable() throws Exception {
        when(auctionService.selectPhase(Role.P)).thenReturn(true);

        mockMvc.perform(post("/phase/select").param("role", "P"))
                .andExpect(status().isOk())
                .andExpect(header().string("HX-Trigger", "fantaStateChanged"));

        verify(auctionService).selectPhase(Role.P);
    }

    @Test
    void selectingThePhaseAlreadyInUseNeitherMovesNorClaimsToHaveMoved() throws Exception {
        when(auctionService.selectPhase(Role.P)).thenReturn(false);

        mockMvc.perform(post("/phase/select").param("role", "P"))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist("HX-Trigger"))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("sei già in fase")));
    }

    @Test
    void theStatusBarOffersEveryPhaseAndMarksTheCurrentOne() throws Exception {
        mockMvc.perform(get("/asta"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("vai a")))
                // La fase corrente e' P: il suo bottone e' segnato e disabilitato,
                // gli altri restano cliccabili — anche quelli precedenti.
                .andExpect(content().string(org.hamcrest.Matchers.matchesPattern(
                        "(?s).*<button[^>]*value=\"P\"[^>]*disabled[^>]*>.*")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("value=\"A\"")));
    }

    @Test
    void aStateChangeThatCompletesThePhaseAnnouncesItInTheSameResponse() throws Exception {
        // RULES da' 1 slot per ruolo a 2 partecipanti: due difensori venduti chiudono
        // la fase D. L'avviso deve arrivare nella risposta al comando che la chiude,
        // non al ricaricamento successivo della pagina.
        AuctionState completa = AuctionProjector.project(RULES, PARTICIPANTS, id -> Role.D,
                List.of(new AuctionEvent.PhaseAdvanced(1L, java.time.Instant.now(), Role.D),
                        new AuctionEvent.PlayerPurchased(2L, java.time.Instant.now(), "d1", "me", 10),
                        new AuctionEvent.PlayerPurchased(3L, java.time.Instant.now(), "d2", "marco", 10)));
        when(auctionService.state()).thenReturn(completa);

        mockMvc.perform(post("/command").param("cmd", "bast 47"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("completa")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("vai alla fase")))
                // Non bloccante: c'e' sempre il modo di chiuderlo e restare sulla fase
                // per correggere un acquisto.
                .andExpect(content().string(org.hamcrest.Matchers.containsString("phase-done-close")));
    }

    @Test
    void thePhaseCompleteNoticeIsHiddenWhileTheRoleStillHasFreeSlots() throws Exception {
        mockMvc.perform(get("/asta"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.matchesPattern(
                        "(?s).*<div id=\"phaseDone\"[^>]*hidden[^>]*>.*")));
    }

    @Test
    void theLastPhaseWhenCompleteOffersNoNextPhaseButton() throws Exception {
        AuctionState ultimaCompleta = AuctionProjector.project(RULES, PARTICIPANTS, id -> Role.A,
                List.of(new AuctionEvent.PhaseAdvanced(1L, java.time.Instant.now(), Role.A),
                        new AuctionEvent.PlayerPurchased(2L, java.time.Instant.now(), "a1", "me", 10),
                        new AuctionEvent.PlayerPurchased(3L, java.time.Instant.now(), "a2", "marco", 10)));
        when(auctionService.state()).thenReturn(ultimaCompleta);

        mockMvc.perform(get("/asta"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("completa")))
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("vai alla fase"))));
    }

    @Test
    void undoIsExposed() throws Exception {
        when(auctionService.undoLast()).thenReturn(true);

        mockMvc.perform(post("/undo")).andExpect(status().isOk());

        verify(auctionService).undoLast();
    }

    @Test
    void theUndoButtonIsDisabledWhenThereIsNothingToUndo() throws Exception {
        // Stato senza holdings: state() nel @BeforeEach è già proiettato da una lista
        // vuota di eventi, quindi canUndo deve risultare false e il bottone disabilitato
        // — sempre presente, mai nascosto, così la sua posizione resta prevedibile.
        mockMvc.perform(get("/asta"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString(
                        "annulla ultimo")))
                .andExpect(content().string(org.hamcrest.Matchers.matchesPattern(
                        "(?s).*<button[^>]*disabled[^>]*>↩ annulla ultimo</button>.*")));
    }

    @Test
    void theUndoButtonIsEnabledAfterAPurchase() throws Exception {
        AuctionState afterPurchase = AuctionProjector.project(RULES, PARTICIPANTS, id -> Role.D,
                List.of(new AuctionEvent.PlayerPurchased(1L, java.time.Instant.now(), "d1", "me", 47)));
        when(auctionService.state()).thenReturn(afterPurchase);

        mockMvc.perform(get("/asta"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.matchesPattern(
                                "(?s).*<button[^>]*disabled[^>]*>↩ annulla ultimo</button>.*"))));
    }

    @Test
    void aSuccessfulPurchaseUpdatesTheBoardNotJustTheAnalysisPanel() throws Exception {
        // Simula lo stato dopo l'acquisto: budget di "me" sceso da 100 a 53 (100 - 47).
        // Un test che verificasse solo status 200 non avrebbe scoperto il difetto B,
        // per cui il tabellone restava indietro di un acquisto intero.
        AuctionState afterPurchase = AuctionProjector.project(RULES, PARTICIPANTS, id -> Role.D,
                List.of(new AuctionEvent.PlayerPurchased(1L, java.time.Instant.now(), "d1", "me", 47)));
        when(auctionService.state()).thenReturn(afterPurchase);

        mockMvc.perform(post("/command").param("cmd", "bast 47"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("53")));

        verify(auctionService).recordPurchase("d1", "me", 47);
    }

    @Test
    void typingAPriceStillShowsTheAnalysisPanel() throws Exception {
        // M5: /fragments/main deve passare da CommandParser come /command. Se cercasse
        // sul testo grezzo "bast 47" invece che sul solo termine "bast", la ricerca non
        // troverebbe nulla e il pannello di analisi — con sopra il max bid — sparirebbe
        // proprio mentre l'utente digita ancora il prezzo.
        mockMvc.perform(get("/fragments/main").param("cmd", "bast 47"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Bastoni")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("47")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("38")));

        verify(searchService).search("bast");
    }

    @Test
    void theLiveSearchFragmentNeverContainsTheCommandInput() throws Exception {
        // #cmd deve vivere fuori dalla regione sostituita a ogni ricerca: se ricomparisse
        // qui, uno swap durante la digitazione lo svuoterebbe di nuovo (il difetto A).
        mockMvc.perform(get("/fragments/main").param("cmd", "bast"))
                .andExpect(status().isOk())
                .andExpect(content().string(
                        org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("id=\"cmd\""))));
    }

    private static com.fantaagent.domain.player.PlayerProjection projection(String id, double basePoints) {
        return new com.fantaagent.domain.player.PlayerProjection(
                id, Role.D, 6.2, 3.0, 20.0, basePoints, 20.0);
    }

    @Test
    void theFirstPageOfThePhaseTableShowsTheHeadingAndAsksTheServiceForItsOwnBatchSize() throws Exception {
        PlayerSearchService.PhaseRow row = new PlayerSearchService.PhaseRow(
                BASTONI, RECOMMENDATION, projection("d1", 120.0));
        when(searchService.phasePlayers(0, PlayerSearchService.PHASE_PAGE_SIZE))
                .thenReturn(new PlayerSearchService.PhasePage(List.of(row), false, 1));

        mockMvc.perform(get("/fragments/phase-players").param("offset", "0"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("GIOCATORI FASE")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Bastoni")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("assegna")));

        verify(searchService).phasePlayers(0, PlayerSearchService.PHASE_PAGE_SIZE);
    }

    @Test
    void aFollowingPageOfThePhaseTableDoesNotRepeatTheHeading() throws Exception {
        // offset > 0 arriva dal bottone "carica altri 25": la risposta sostituisce solo
        // la riga del bottone, quindi non deve ripetere l'intestazione del pannello.
        PlayerSearchService.PhaseRow row = new PlayerSearchService.PhaseRow(
                BASTONI, RECOMMENDATION, projection("d1", 90.0));
        when(searchService.phasePlayers(25, PlayerSearchService.PHASE_PAGE_SIZE))
                .thenReturn(new PlayerSearchService.PhasePage(List.of(row), true, 50));

        mockMvc.perform(get("/fragments/phase-players").param("offset", "25"))
                .andExpect(status().isOk())
                .andExpect(content().string(
                        org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("GIOCATORI FASE"))))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("carica altri 25")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("offset=50")));
    }
}
