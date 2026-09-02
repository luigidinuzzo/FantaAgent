package com.fantaagent.adapter.in.web;

import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.application.service.AuctionService;
import com.fantaagent.application.service.PlayerAnalysisService;
import com.fantaagent.application.service.PlayerSearchService;
import com.fantaagent.domain.auction.AuctionProjector;
import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Player;
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

import java.lang.reflect.Constructor;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * La pagina BATTITORE viene proiettata su uno schermo che guardano tutti gli
 * avversari. Questi test difendono una cosa sola, ma la difendono per davvero:
 * da li' non esce nessuna informazione strategica.
 */
@SpringBootTest
@ActiveProfiles("dev")
class BattitoreControllerTest {

    private static final LeagueRules RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static final List<Participant> PARTICIPANTS = List.of(
            new Participant("me", "Io", 'I', true),
            new Participant("marco", "Marco", 'M', false));

    /** Quotazione 12: e' sul listone cartaceo di tutti, quindi puo' comparire. */
    private static final Player DIMARCO = new Player("d1", "Dimarco", "Inter", Role.D, 12);

    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private AuctionService auctionService;

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
        when(auctionRuntime.hasAuction()).thenReturn(true);
        AuctionState state = AuctionProjector.project(RULES, PARTICIPANTS, id -> Role.D, List.of());
        when(auctionService.state()).thenReturn(state);
        when(auctionService.participants()).thenReturn(PARTICIPANTS);
        when(searchService.search(anyString())).thenReturn(List.of(DIMARCO));
        when(playerCatalog.byId("d1")).thenReturn(Optional.of(DIMARCO));
    }

    /**
     * Il test centrale. Il popup proiettato non deve portare con se' il max bid in
     * nessuna forma: ne' come numero visibile, ne' come attributo data-* che chiunque
     * potrebbe leggere aprendo il sorgente della pagina dallo schermo condiviso.
     */
    @Test
    void ilPopupProiettatoNonPortaAlcunaValutazione() throws Exception {
        mockMvc.perform(get("/battitore/popup").param("playerId", "d1"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("Dimarco")))
                .andExpect(content().string(not(containsString("data-max-bid"))))
                .andExpect(content().string(not(containsString("data-hard-cap"))))
                .andExpect(content().string(not(containsString("MAX BID"))))
                .andExpect(content().string(not(containsString("MERCATO"))))
                .andExpect(content().string(not(containsString("VERDETTO"))));
    }

    /** Cio' che serve per battere, invece, deve esserci tutto. */
    @Test
    void ilPopupProiettatoPortaTimerRilanciEaggiudicazione() throws Exception {
        mockMvc.perform(get("/battitore/popup").param("playerId", "d1"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("data-seconds")))
                .andExpect(content().string(containsString("bidderBid")))
                .andExpect(content().string(containsString("bidderAssign")))
                .andExpect(content().string(containsString("Marco")));
    }

    /**
     * La pagina non mostra le colonne strategiche della tabella di fase: max bid,
     * fantamedia attesa e titolarita' sono numeri calcolati da noi, non dati del
     * listone, e proiettarli regalerebbe agli avversari il nostro modello.
     */
    @Test
    void laPaginaNonMostraColonneStrategiche() throws Exception {
        mockMvc.perform(get("/battitore"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("BATTITORE")))
                .andExpect(content().string(not(containsString("Max bid"))))
                .andExpect(content().string(not(containsString("MAX BID"))))
                .andExpect(content().string(not(containsString("Fantamedia"))))
                .andExpect(content().string(not(containsString("Titolarità"))))
                .andExpect(content().string(not(containsString("TARGET"))));
    }

    /**
     * La ricerca restituisce i quattro dati del listone cartaceo e nient'altro: nome,
     * ruolo, squadra, quotazione.
     */
    @Test
    void laRicercaRestituisceSoloDatiDelListone() throws Exception {
        mockMvc.perform(get("/battitore/cerca").param("q", "dima"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("Dimarco")))
                .andExpect(content().string(containsString("Inter")))
                .andExpect(content().string(containsString("12")))
                .andExpect(content().string(not(containsString("data-max-bid"))))
                .andExpect(content().string(not(containsString("MAX BID"))));
    }

    /**
     * Guardia strutturale, ed e' quella che sopravvive a chi verra' dopo. I test sopra
     * verificano cosa esce oggi; questo verifica che la pagina non abbia nemmeno il
     * mezzo per calcolare una valutazione. Iniettare qui PlayerAnalysisService e' il
     * gesto che precede ogni possibile fuga: deve rompere un test, non passare
     * inosservato in una riga di costruttore.
     */
    @Test
    void ilControllerNonHaAccessoAlMotoreDiValutazione() {
        Constructor<?>[] constructors = BattitoreController.class.getDeclaredConstructors();
        assertThat(constructors).hasSize(1);
        assertThat(Arrays.asList(constructors[0].getParameterTypes()))
                .as("la pagina proiettata non deve poter calcolare raccomandazioni")
                .doesNotContain(PlayerAnalysisService.class);
    }

    /** L'aggiudicazione passa dallo stesso recordPurchase di ogni altra via. */
    @Test
    void laggiudicazioneRegistraLacquistoDalServizioCondiviso() throws Exception {
        mockMvc.perform(post("/battitore/assegna")
                        .param("playerId", "d1")
                        .param("participantId", "marco")
                        .param("price", "23"))
                .andExpect(status().isOk());

        verify(auctionService).recordPurchase("d1", "marco", 23);
    }

    @Test
    void laRevocaPassaDalServizioCondiviso() throws Exception {
        mockMvc.perform(post("/battitore/revoca").param("targetSeq", "3"))
                .andExpect(status().isOk());

        verify(auctionService).revokePurchase(3L);
    }

    /**
     * Con slot ancora liberi non si annuncia nulla: un banner "fase completa" acceso a
     * meta' ruolo, su uno schermo che guardano tutti, e' peggio di nessun banner.
     */
    @Test
    void nessunAnnuncioSeLaFaseNonEcompleta() throws Exception {
        mockMvc.perform(get("/battitore"))
                .andExpect(status().isOk())
                // Sulla classe del banner e non sulla parola "completa": quella compare
                // anche nei commenti del template, che finiscono nell'HTML servito.
                .andExpect(content().string(not(containsString("battitore-phase-done"))));
    }

    /**
     * Chiuso l'ultimo slot del ruolo, il tabellone annuncia la fase completa e offre
     * l'avanzamento. Il banner sta dentro #board perche' e' l'ultimo acquisto a
     * renderlo vero, ed e' #board che quell'acquisto ridisegna.
     */
    @Test
    void aFaseCompletaIlTabelloneAnnunciaEoffreLavanzamento() throws Exception {
        when(auctionService.state()).thenReturn(statoConFaseCompleta());

        mockMvc.perform(post("/battitore/revoca").param("targetSeq", "99"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("battitore-phase-done")))
                .andExpect(content().string(containsString("vai alla fase")));
    }

    /** L'avanzamento resta un gesto voluto: nessun acquisto lo fa scattare da solo. */
    @Test
    void unAcquistoNonAvanzaLaFaseDaSolo() throws Exception {
        when(auctionService.state()).thenReturn(statoConFaseCompleta());

        mockMvc.perform(post("/battitore/assegna")
                        .param("playerId", "d1").param("participantId", "marco").param("price", "5"))
                .andExpect(status().isOk());

        verify(auctionService, org.mockito.Mockito.never()).advancePhase();
    }

    /** Il bottone avanza, e l'indicatore FASE in testa alla pagina viaggia con lui. */
    @Test
    void ilBottoneAvanzaLaFaseEaggiornaLindicatore() throws Exception {
        mockMvc.perform(post("/battitore/fase"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("phaseBadge")))
                .andExpect(content().string(containsString("hx-swap-oob")));

        verify(auctionService).advancePhase();
    }

    /**
     * Una pagina intera non deve contenere il fragment composito: se boardUpdate
     * vivesse dentro battitore.html, ogni caricamento stamperebbe una seconda copia
     * del tabellone sotto la prima.
     */
    @Test
    void laPaginaInteraNonDuplicaIlTabellone() throws Exception {
        String html = mockMvc.perform(get("/battitore"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(html.split("id=\"board\"", -1).length - 1)
                .as("#board deve comparire una volta sola").isEqualTo(1);
        assertThat(html.split("id=\"phaseBadge\"", -1).length - 1)
                .as("l'indicatore FASE deve comparire una volta sola").isEqualTo(1);
    }

    /** Fase P chiusa: entrambi i partecipanti hanno riempito il loro unico slot P. */
    private static AuctionState statoConFaseCompleta() {
        return AuctionProjector.project(RULES, PARTICIPANTS, id -> Role.P,
                List.of(new com.fantaagent.domain.auction.AuctionEvent.PlayerPurchased(
                                1, java.time.Instant.EPOCH, "p1", "me", 10),
                        new com.fantaagent.domain.auction.AuctionEvent.PlayerPurchased(
                                2, java.time.Instant.EPOCH, "p2", "marco", 10)));
    }

    /**
     * L'export scarica un file invece di renderlo in pagina: senza
     * Content-Disposition attachment il browser mostrerebbe il CSV a schermo — sulla
     * pagina proiettata, davanti a tutti — invece di salvarlo.
     */
    @Test
    void lExportScaricaUnCsvConIlNomeDellAsta() throws Exception {
        when(auctionRuntime.currentAuctionId()).thenReturn("2026-09-01");

        mockMvc.perform(get("/battitore/esporta"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .header().string("Content-Disposition",
                                containsString("attachment; filename=\"rose-2026-09-01.csv\"")))
                .andExpect(content().contentTypeCompatibleWith("text/csv"));
    }

    /** Senza un'asta scelta non c'e' nulla da esportare: 404, non un file vuoto. */
    @Test
    void senzaAstaLExportNonProduceUnFileVuoto() throws Exception {
        when(auctionRuntime.hasAuction()).thenReturn(false);

        mockMvc.perform(get("/battitore/esporta"))
                .andExpect(status().isNotFound());
    }

    /** Il bottone deve esserci: senza, l'endpoint esiste ma non lo raggiunge nessuno. */
    @Test
    void laPaginaOffreIlBottoneEsporta() throws Exception {
        mockMvc.perform(get("/battitore"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("ESPORTA")))
                .andExpect(content().string(containsString("/battitore/esporta")));
    }

    /**
     * Aperto con subito=true il popup dichiara la modalita' immediata: bidder.js salta
     * il countdown e mostra subito l'aggiudicazione. Serve quando non c'e' un'asta da
     * battere e aspettare un timer che non misura nulla e' solo tempo perso.
     */
    @Test
    void ilPopupPuoAprirsiGiaInAggiudicazione() throws Exception {
        mockMvc.perform(get("/battitore/popup").param("playerId", "d1").param("subito", "true"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("data-immediate=\"true\"")))
                .andExpect(content().string(containsString("bidderAssign")));
    }

    /** Senza il parametro il popup parte col countdown, come sempre. */
    @Test
    void senzaIlParametroIlPopupParteColCountdown() throws Exception {
        mockMvc.perform(get("/battitore/popup").param("playerId", "d1"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("data-immediate=\"false\"")))
                .andExpect(content().string(containsString("bidderNow")));
    }

    /** Ogni risultato offre entrambe le vie: batti il timer, oppure assegna e basta. */
    @Test
    void ogniRisultatoOffreSiaLAstaSiaLAssegnazioneDiretta() throws Exception {
        mockMvc.perform(get("/battitore/cerca").param("q", "dima"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("batti")))
                .andExpect(content().string(containsString("assegna")))
                .andExpect(content().string(containsString("subito=true")));
    }

    /** Un id sconosciuto non apre alcun popup, invece di aprirne uno vuoto. */
    @Test
    void unGiocatoreInesistenteNonApreAlcunPopup() throws Exception {
        when(playerCatalog.byId("ignoto")).thenReturn(Optional.empty());

        mockMvc.perform(get("/battitore/popup").param("playerId", "ignoto"))
                .andExpect(status().isOk())
                .andExpect(content().string(not(containsString("bidderDialog"))));
    }
}
