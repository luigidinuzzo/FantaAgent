package com.fantaagent.adapter.in.web;

import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueMembersSettingsStore;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * La schermata Impostazioni in due modalita'.
 *
 * <p>PREPARAZIONE: nessuna asta aperta, tutto modificabile, un solo pulsante che
 * conferma l'intero blocco e crea l'asta. ASTA IN CORSO: regole in sola lettura, nomi e
 * battitore sempre modificabili.
 */
@SpringBootTest
@ActiveProfiles("dev")
class SettingsControllerTest {

    private static final LeagueRules RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static final List<Participant> PARTICIPANTS = List.of(
            new Participant("me", "Io", 'I', true),
            new Participant("marco", "Marco", 'M', false));

    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private com.fantaagent.application.service.AuctionService auctionService;

    @MockitoBean
    private LeagueMembersSettingsStore membersStore;

    @MockitoBean
    private com.fantaagent.application.service.AuctionRuntime auctionRuntime;

    /** Finti apposta: store veri scriverebbero davvero nella data-dir del progetto. */
    @MockitoBean
    private com.fantaagent.config.ScoringSettingsStore scoringStore;

    @MockitoBean
    private com.fantaagent.config.AuctionSettingsStore auctionStore;

    @Autowired
    private com.fantaagent.config.AuctionSettingsHolder auctionSettings;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
        when(membersStore.file()).thenReturn(Path.of("res/league-members.yml"));
        when(membersStore.load()).thenReturn(Optional.empty());
        when(scoringStore.file()).thenReturn(Path.of("res/league-settings.yml"));
        when(scoringStore.load()).thenReturn(Optional.empty());
        when(auctionStore.file()).thenReturn(Path.of("res/auction-settings.yml"));
        when(auctionStore.load()).thenReturn(Optional.empty());
        when(auctionRuntime.snapshot()).thenAnswer(inv -> snapshot());
        auctionSettings.set(AuctionSettings.DEFAULTS);
        preparing();
    }

    private void preparing() {
        when(auctionRuntime.hasAuction()).thenReturn(false);
        when(auctionRuntime.currentAuctionLabel()).thenReturn(null);
    }

    private void running() {
        when(auctionRuntime.hasAuction()).thenReturn(true);
        when(auctionRuntime.currentAuctionLabel()).thenReturn("Lega Brontolo");
    }

    /** Un invio completo e valido, come lo manderebbe il form. */
    private static MockHttpServletRequestBuilder fullForm() {
        return form("Lega Brontolo", "7", "I", "M");
    }

    /**
     * I parametri variabili si passano qui e non si sovrascrivono dopo: MockMvc
     * ACCUMULA i valori di uno stesso parametro invece di sostituirli, e un
     * .param("auctionName", "") aggiunto in coda lascerebbe vincere il valore
     * precedente — un test che passa senza provare nulla.
     */
    private static MockHttpServletRequestBuilder form(String auctionName, String timerSeconds,
                                                      String initial1, String initial2) {
        return post("/impostazioni")
                .param("auctionName", auctionName)
                .param("defenceModifierEnabled", "true")
                .param("defendersCounted", "3")
                .param("minAverage", "0", "6")
                .param("bonus", "0", "1")
                .param("goalBonusP", "3").param("goalBonusD", "3")
                .param("goalBonusC", "3").param("goalBonusA", "3")
                .param("assist", "1").param("penaltyScored", "3")
                .param("penaltyMissed", "-3").param("penaltySaved", "3")
                .param("yellowCard", "-0,5").param("redCard", "-1")
                .param("goalConceded", "-1").param("cleanSheet", "1")
                .param("confirmed", "true")
                .param("id", "me", "marco")
                .param("name", "Io", "Marco")
                .param("initial", initial1, initial2)
                .param("me", "me")
                .param("bidTimerSeconds", timerSeconds)
                .param("beepEnabled", "true");
    }

    private static com.fantaagent.application.service.RuntimeSnapshot snapshot() {
        com.fantaagent.application.port.out.PlayerCatalog catalog =
                new com.fantaagent.adapter.out.file.InMemoryPlayerCatalog(List.of(), List.of());
        java.util.Map<Role, Double> goalBonus = new java.util.EnumMap<>(Role.class);
        for (Role role : Role.values()) {
            goalBonus.put(role, 3.0);
        }
        com.fantaagent.domain.league.ScoringRules scoring =
                new com.fantaagent.domain.league.ScoringRules(true, goalBonus, 1.0, 3.0, -3.0,
                        3.0, -0.5, -1.0, -1.0, 1.0,
                        new com.fantaagent.domain.league.ModifierTable(3, List.of(
                                new com.fantaagent.domain.league.ModifierTable.Threshold(0.0, 0.0))),
                        new com.fantaagent.domain.league.ModifierTable(0, List.of(
                                new com.fantaagent.domain.league.ModifierTable.Threshold(0.0, 0.0))),
                        0.55);
        return new com.fantaagent.application.service.RuntimeSnapshot(null, null, PARTICIPANTS,
                com.fantaagent.application.service.ValuationChain.build(
                        RULES, scoring, catalog, List.of(1.0)));
    }

    // ---------- preparazione ----------

    /**
     * Un solo pulsante per l'intero blocco. Con tre separati si poteva uscire avendone
     * premuto uno solo, convinti di aver salvato tutto.
     */
    @Test
    void laPreparazioneHaUnSoloFormEUnSoloPulsante() throws Exception {
        String html = mockMvc.perform(get("/impostazioni"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(html.split("<form", -1).length - 1).as("un solo form").isEqualTo(1);
        assertThat(html.split("type=\"submit\"", -1).length - 1)
                .as("un solo pulsante di invio").isEqualTo(1);
        assertThat(html).contains("auctionName");
    }

    /** Da qui si torna solo indietro: nessuna scorciatoia verso altre pagine. */
    @Test
    void laPreparazioneOffreSoloIlRitornoAllaHome() throws Exception {
        mockMvc.perform(get("/impostazioni"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("indietro alla home")))
                .andExpect(content().string(not(containsString("/riepilogo"))))
                .andExpect(content().string(not(containsString("/battitore"))));
    }

    /**
     * E' la conferma a creare l'asta, non il click sulla home: prima la cartella
     * nasceva subito e chi tornava indietro lasciava un'asta vuota nell'elenco.
     */
    @Test
    void laConfermaSalvaTuttoEcreaLastaConIlSuoNome() throws Exception {
        mockMvc.perform(fullForm())
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("/asta"));

        verify(scoringStore).save(any());
        verify(membersStore).save(any());
        verify(auctionStore).save(new AuctionSettings(7, true));
        verify(auctionRuntime).createNew("Lega Brontolo");
    }

    /** Senza nome non si parte, e soprattutto non si crea nulla. */
    @Test
    void senzaNomeNonSiCreaAlcunAsta() throws Exception {
        String html = mockMvc.perform(form("", "7", "I", "M"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        // Senza apostrofo: Thymeleaf lo rende come &#39; e cercare il testo cosi' come
        // e' scritto nel codice darebbe un test che fallisce per la ragione sbagliata.
        assertThat(html).contains("Dai un nome all");

        verify(auctionRuntime, never()).createNew(anyString());
        verify(scoringStore, never()).save(any());
    }

    /**
     * Gli errori delle tre sezioni si mostrano insieme: con un solo invio, riportarne
     * uno per volta costringerebbe a tre giri per scoprire tre problemi gia' tutti
     * visibili.
     */
    @Test
    void gliErroriDelleTreSezioniCompaionoInsieme() throws Exception {
        String html = mockMvc.perform(form("", "0", "X", "X"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(html).contains("Dai un nome all");
        assertThat(html).contains("durata del timer");
        assertThat(html).contains("iniziale");

        verify(auctionRuntime, never()).createNew(anyString());
    }

    // ---------- asta in corso ----------

    /**
     * Le regole non vengono nemmeno lette: i campi disabilitati fermano il browser,
     * questo ferma una richiesta costruita a mano.
     */
    @Test
    void adAstaApertaLeRegoleNonVengonoSalvate() throws Exception {
        running();

        mockMvc.perform(fullForm().param("assist", "99"))
                .andExpect(status().isOk());

        verify(scoringStore, never()).save(any());
        verify(auctionRuntime, never()).createNew(anyString());
    }

    /** Nomi e battitore restano modificabili, e in vigore subito. */
    @Test
    void adAstaApertaNomiEbattitoreRestanoModificabili() throws Exception {
        running();

        mockMvc.perform(fullForm().param("name", "Anna", "Marco"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("già in vigore")));

        verify(membersStore).save(any());
        verify(auctionStore).save(new AuctionSettings(7, true));
        verify(auctionRuntime).rebuild();
        assertThat(auctionSettings.get()).isEqualTo(new AuctionSettings(7, true));
    }

    /** Ad asta aperta si torna all'asta, e da nessun'altra parte. */
    @Test
    void adAstaApertaSiTornaSoloAllAsta() throws Exception {
        running();

        mockMvc.perform(get("/impostazioni"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("indietro all")))
                .andExpect(content().string(containsString("Sola lettura")))
                .andExpect(content().string(containsString("Lega Brontolo")))
                .andExpect(content().string(not(containsString("/riepilogo"))));
    }
}
