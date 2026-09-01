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

    /** Un id sconosciuto non apre alcun popup, invece di aprirne uno vuoto. */
    @Test
    void unGiocatoreInesistenteNonApreAlcunPopup() throws Exception {
        when(playerCatalog.byId("ignoto")).thenReturn(Optional.empty());

        mockMvc.perform(get("/battitore/popup").param("playerId", "ignoto"))
                .andExpect(status().isOk())
                .andExpect(content().string(not(containsString("bidderDialog"))));
    }
}
