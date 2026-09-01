package com.fantaagent.adapter.in.web;

import com.fantaagent.application.service.AuctionService;
import com.fantaagent.config.LeagueMembersSettingsStore;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.auction.AuctionProjector;
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
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Sezione PARTECIPANTI della schermata Impostazioni: modifica dei nomi senza toccare
 * gli id, che il registro dell'asta usa per attribuire gli acquisti.
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
    private AuctionService auctionService;

    @MockitoBean
    private LeagueMembersSettingsStore membersStore;

    @MockitoBean
    private com.fantaagent.application.service.AuctionRuntime auctionRuntime;

    /**
     * Finto apposta: uno store vero punterebbe alla data-dir del profilo dev e
     * SCRIVEREBBE davvero un file di impostazioni nel progetto.
     */
    @MockitoBean
    private com.fantaagent.config.ScoringSettingsStore scoringStore;

    /** Finto per la stessa ragione dello store di punteggio: non scrivere nel progetto. */
    @MockitoBean
    private com.fantaagent.config.AuctionSettingsStore auctionStore;

    @org.springframework.beans.factory.annotation.Autowired
    private com.fantaagent.config.AuctionSettingsHolder auctionSettings;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
        when(membersStore.file()).thenReturn(Path.of("res/league-members.yml"));
        when(membersStore.load()).thenReturn(Optional.empty());
        when(auctionService.state()).thenReturn(
                AuctionProjector.project(RULES, PARTICIPANTS, id -> Role.D, List.of()));
        when(auctionRuntime.snapshot()).thenAnswer(inv -> snapshot());
        when(scoringStore.file()).thenReturn(Path.of("res/league-settings.yml"));
        when(scoringStore.load()).thenReturn(Optional.empty());
        when(auctionStore.file()).thenReturn(Path.of("res/auction-settings.yml"));
        when(auctionStore.load()).thenReturn(Optional.empty());
        auctionSettings.set(com.fantaagent.config.AuctionSettings.DEFAULTS);
    }

    /**
     * Il salvataggio non si limita a scrivere il file: aggiorna anche le impostazioni in
     * vigore. Senza la seconda meta', il nuovo timer si vedrebbe solo dopo un riavvio —
     * esattamente cio' che si e' voluto togliere.
     */
    @Test
    void lePreferenzeDelBattitoreSonoInVigoreSubitoDopoIlSalvataggio() throws Exception {
        mockMvc.perform(post("/impostazioni/asta")
                        .param("bidTimerSeconds", "9")
                        .param("beepEnabled", "true"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("già in vigore")));

        verify(auctionStore).save(new com.fantaagent.config.AuctionSettings(9, true));
        org.assertj.core.api.Assertions.assertThat(auctionSettings.get())
                .isEqualTo(new com.fantaagent.config.AuctionSettings(9, true));
    }

    /**
     * A differenza delle regole di punteggio, queste restano modificabili ad asta
     * iniziata: non entrano in nessun calcolo, e il momento in cui ci si accorge che il
     * countdown e' sbagliato e' proprio mentre si batte.
     */
    @Test
    void lePreferenzeDelBattitoreRestanoModificabiliAdAstaIniziata() throws Exception {
        when(auctionService.state()).thenReturn(AuctionProjector.project(RULES, PARTICIPANTS,
                id -> Role.D,
                List.of(new com.fantaagent.domain.auction.AuctionEvent.PlayerPurchased(
                        1, java.time.Instant.EPOCH, "d1", "me", 10))));

        mockMvc.perform(post("/impostazioni/asta")
                        .param("bidTimerSeconds", "12")
                        .param("beepEnabled", "false"))
                .andExpect(status().isOk());

        verify(auctionStore).save(new com.fantaagent.config.AuctionSettings(12, false));
    }

    /**
     * Una durata assurda non deve essere ne' scritta su disco ne' messa in vigore: un
     * countdown di zero secondi renderebbe il battitore inutilizzabile senza che nulla
     * spieghi perche'.
     */
    @Test
    void unaDurataNonValidaNonVieneSalvataNeMessaInVigore() throws Exception {
        mockMvc.perform(post("/impostazioni/asta")
                        .param("bidTimerSeconds", "0")
                        .param("beepEnabled", "true"))
                .andExpect(status().isOk())
                .andExpect(content().string(
                        org.hamcrest.Matchers.containsString("durata del timer")));

        verify(auctionStore, never()).save(any());
        org.assertj.core.api.Assertions.assertThat(auctionSettings.get())
                .isEqualTo(com.fantaagent.config.AuctionSettings.DEFAULTS);
    }

    /**
     * Lo snapshot che il runtime pubblicherebbe: partecipanti e catena di valutazione
     * in un unico blocco coerente, esattamente come li legge la pagina.
     */
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

    @Test
    void savingTheScoringRulesPutsThemInServiceAtOnceInsteadOfAskingForARestart() throws Exception {
        mockMvc.perform(post("/impostazioni")
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
                        .param("confirmed", "true"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("già in vigore")))
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("prossimo avvio"))));

        verify(scoringStore).save(any());
        verify(auctionRuntime).rebuild();
    }

    @Test
    void theScoringRulesAreFrozenOnceThereIsAPurchaseAndNothingIsRebuilt() throws Exception {
        when(auctionService.state()).thenReturn(AuctionProjector.project(RULES, PARTICIPANTS,
                id -> Role.D,
                List.of(new AuctionEvent.PlayerPurchased(1, Instant.now(), "d1", "me", 20))));

        mockMvc.perform(post("/impostazioni")
                        .param("defendersCounted", "3")
                        .param("confirmed", "true"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("già iniziata")));

        verify(scoringStore, never()).save(any());
        verify(auctionRuntime, never()).rebuild();
    }

    @Test
    void savingPersistsTheNewNamesWithTheSameIds() throws Exception {
        mockMvc.perform(post("/impostazioni/partecipanti")
                        .param("id", "me", "marco")
                        .param("name", "Gigi", "Marco")
                        .param("initial", "I", "M")
                        .param("me", "me"))
                .andExpect(status().isOk());

        verify(membersStore).save(List.of(
                new Participant("me", "Gigi", 'I', true),
                new Participant("marco", "Marco", 'M', false)));
    }

    @Test
    void duplicateInitialsAreRejectedNamingTheClash() throws Exception {
        mockMvc.perform(post("/impostazioni/partecipanti")
                        .param("id", "me", "marco")
                        .param("name", "Io", "Marco")
                        .param("initial", "M", "M")
                        .param("me", "me"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("iniziale")));

        verify(membersStore, never()).save(any());
    }

    /**
     * Assertion cambiata di proposito rispetto a prima, quando il salvataggio veniva
     * rifiutato ad asta iniziata: nomi e iniziali sono ora sempre modificabili. Il
     * registro lega gli acquisti agli id, che questa pagina non tocca, quindi cambia
     * solo cio' che si legge a schermo — e cambia subito, senza riavvio.
     */
    @Test
    void editingIsStillAllowedOncePurchasesExistBecauseOnlyTheDisplayedNamesChange() throws Exception {
        when(auctionService.state()).thenReturn(AuctionProjector.project(RULES, PARTICIPANTS,
                id -> Role.D,
                List.of(new AuctionEvent.PlayerPurchased(1, Instant.now(), "d1", "me", 20))));

        mockMvc.perform(post("/impostazioni/partecipanti")
                        .param("id", "me", "marco")
                        .param("name", "Gigi", "Marco")
                        .param("initial", "I", "M")
                        .param("me", "me"))
                .andExpect(status().isOk());

        verify(membersStore).save(List.of(
                new Participant("me", "Gigi", 'I', true),
                new Participant("marco", "Marco", 'M', false)));
    }

    /** Il salvataggio deve rimettere in servizio l'intera catena, non aggiornarla a pezzi. */
    @Test
    void savingParticipantsRebuildsTheWholeChainAtOnce() throws Exception {
        mockMvc.perform(post("/impostazioni/partecipanti")
                        .param("id", "me", "marco")
                        .param("name", "Gigi", "Marco")
                        .param("initial", "I", "M")
                        .param("me", "me"))
                .andExpect(status().isOk());

        verify(auctionRuntime).rebuild();
    }

    @Test
    void aRejectedParticipantsSaveDoesNotRebuildAnything() throws Exception {
        mockMvc.perform(post("/impostazioni/partecipanti")
                        .param("id", "me", "marco")
                        .param("name", "Io", "Marco")
                        .param("initial", "M", "M")
                        .param("me", "me"))
                .andExpect(status().isOk());

        verify(auctionRuntime, never()).rebuild();
    }
}
