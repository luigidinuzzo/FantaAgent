package com.fantaagent.application.service;

import com.fantaagent.adapter.out.file.FileAuctionArchive;
import com.fantaagent.adapter.out.file.InMemoryPlayerCatalog;
import com.fantaagent.application.port.out.AuctionArchive;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.ModifierTable;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.league.ScoringRules;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Selezione e creazione di aste: aprire un file diverso, mai riscriverne uno esistente. */
class AuctionRuntimeTest {

    @TempDir
    Path tmp;

    private static final LeagueRules RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static final List<Participant> PARTICIPANTS = List.of(
            new Participant("me", "Io", 'I', true),
            new Participant("marco", "Marco", 'M', false));

    private static final List<Role> PHASES = List.of(Role.P, Role.D, Role.C, Role.A);

    private AuctionArchive archive;
    private TestAuctionTemplate template;
    private AuctionRuntime runtime;

    /** Il punteggio del modello, come si salva: condiviso con AuctionRuntimePerAuctionTest. */
    static com.fantaagent.config.ScoringSettings scoringSettings() {
        return com.fantaagent.config.ScoringSettings.from(scoring(), true);
    }

    private static ScoringRules scoring() {
        return scoring(3.0);
    }

    /** Le stesse regole con un bonus gol scelto: serve a distinguere due aste. */
    private static ScoringRules scoring(double bonusGol) {
        Map<Role, Double> bonus = new EnumMap<>(Role.class);
        for (Role role : Role.values()) {
            bonus.put(role, bonusGol);
        }
        return new ScoringRules(true, bonus, 1.0, 3.0, -3.0, 3.0, -0.5, -1.0, -1.0, 1.0,
                new ModifierTable(3, List.of(new ModifierTable.Threshold(0.0, 0.0))),
                new ModifierTable(0, List.of(new ModifierTable.Threshold(0.0, 0.0))), 0.55);
    }

    @BeforeEach
    void setUp() {
        PlayerCatalog catalog = new InMemoryPlayerCatalog(
                List.of(new Player("d1", "Difensore", "Inter", Role.D, 20)), List.of());
        archive = new FileAuctionArchive(tmp);
        template = new TestAuctionTemplate(scoringSettings());
        template.participants = PARTICIPANTS;
        runtime = new AuctionRuntime(catalog, List.of(1.0), PHASES, template, archive);
    }

    @Test
    void allAvvioNessunAstaESelezionata() {
        assertThat(runtime.hasAuction()).isFalse();
        assertThat(runtime.auctions()).isEmpty();
    }

    @Test
    void creaUnAstaSottoUnIdentificativoDatato() {
        String id = runtime.createNew("prova");

        assertThat(id).isEqualTo(LocalDate.now().toString());
        assertThat(runtime.hasAuction()).isTrue();
        assertThat(runtime.snapshot().auctionId()).isEqualTo(id);
        assertThat(tmp.resolve("auctions").resolve(id).resolve("events.jsonl")).exists();
    }

    /**
     * Un registro scritto prima che il nome dell'asta esistesse.
     *
     * <p>Questo test nasce da un difetto vero: la home lanciava NullPointerException su
     * ogni asta priva di nome, cioe' su tutte quelle gia' esistenti. Il codice diceva a
     * parole di gestire il caso, ma nessun test lo copriva perche' ogni asta creata nei
     * test aveva un nome — si provava il percorso nuovo, mai il dato vecchio.
     */
    @Test
    void unRegistroSenzaNomeSiElencaEmostraLIdentificativo() throws Exception {
        String vecchia = "2026-08-30";
        Path dir = tmp.resolve("auctions").resolve(vecchia);
        Files.createDirectories(dir);
        // Esattamente la forma scritta prima che il campo "name" esistesse.
        Files.writeString(dir.resolve("events.jsonl"),
                "{\"type\":\"AuctionStarted\",\"seq\":1,\"at\":\"2026-08-30T08:00:00Z\"}\n");

        List<AuctionRuntime.AuctionSummary> auctions = runtime.auctions();

        assertThat(auctions).extracting(AuctionRuntime.AuctionSummary::id).contains(vecchia);
        AuctionRuntime.AuctionSummary summary = auctions.stream()
                .filter(a -> a.id().equals(vecchia)).findFirst().orElseThrow();
        assertThat(summary.name()).isNull();
        assertThat(summary.label()).isEqualTo(vecchia);

        runtime.select(vecchia);
        assertThat(runtime.currentAuctionLabel()).isEqualTo(vecchia);
    }

    /** E con un nome, e' il nome a comparire. */
    @Test
    void unRegistroConNomeMostraIlNome() {
        runtime.createNew("Lega Brontolo");

        assertThat(runtime.currentAuctionLabel()).isEqualTo("Lega Brontolo");
        assertThat(runtime.auctions()).extracting(AuctionRuntime.AuctionSummary::label)
                .contains("Lega Brontolo");
    }

    /**
     * Ogni asta ha i suoi partecipanti.
     *
     * <p>Erano una configurazione globale: preparare una seconda asta riscriveva i nomi
     * mostrati per la prima. Gli acquisti restavano corretti — il registro li lega agli
     * id — ma le rose comparivano intestate alle persone sbagliate, che su un tabellone
     * proiettato e' indistinguibile da un errore di attribuzione.
     */
    @Test
    void configurareUnAstaNuovaNonCambiaINomiDiQuellaPrecedente() {
        List<Participant> primi = List.of(
                new Participant("me", "Anna", 'A', true),
                new Participant("p2", "Bruno", 'B', false));
        List<Participant> secondi = List.of(
                new Participant("me", "Zoe", 'Z', true),
                new Participant("p2", "Yuri", 'Y', false));

        template.participants = primi;
        AuctionRuntime rt = runtime;

        String prima = rt.createNew("Prima");
        assertThat(rt.snapshot().participants()).isEqualTo(primi);

        template.participants = secondi;
        String seconda = rt.createNew("Seconda");
        assertThat(rt.snapshot().participants()).isEqualTo(secondi);

        rt.select(prima);
        assertThat(rt.snapshot().participants())
                .as("riaprendo la prima si rivedono i suoi nomi")
                .isEqualTo(primi);

        rt.select(seconda);
        assertThat(rt.snapshot().participants()).isEqualTo(secondi);
    }

    /**
     * Ogni asta ha le proprie regole di punteggio.
     *
     * <p>Erano globali, e la posta e' piu' alta dei nomi: da queste regole discendono i
     * punti attesi di ogni giocatore, quindi configurare una nuova asta cambiava i
     * NUMERI mostrati per quelle vecchie. Una rosa gia' pagata si rileggeva con un
     * modello diverso da quello con cui era stata comprata.
     */
    @Test
    void configurareUnAstaNuovaNonCambiaINumeriDiQuellaPrecedente() {
        template.scoring = com.fantaagent.config.ScoringSettings.from(scoring(3.0), false);
        AuctionRuntime rt = runtime;

        String prima = rt.createNew("Prima");
        assertThat(rt.snapshot().chain().scoring().goalBonus(Role.D)).isEqualTo(3.0);

        template.scoring = com.fantaagent.config.ScoringSettings.from(scoring(9.0), false);
        String seconda = rt.createNew("Seconda");
        assertThat(rt.snapshot().chain().scoring().goalBonus(Role.D)).isEqualTo(9.0);

        rt.select(prima);
        assertThat(rt.snapshot().chain().scoring().goalBonus(Role.D))
                .as("riaprendo la prima si rivedono i suoi numeri")
                .isEqualTo(3.0);

        rt.select(seconda);
        assertThat(rt.snapshot().chain().scoring().goalBonus(Role.D)).isEqualTo(9.0);
    }

    /** Rinominare durante una serata resta dentro quella serata. */
    @Test
    void rinominareInUnAstaNonTocaLeAltre() {
        String prima = runtime.createNew("Prima");
        String seconda = runtime.createNew("Seconda");

        runtime.setParticipants(List.of(
                new Participant("me", "Rinominato", 'R', true),
                new Participant("marco", "Marco", 'M', false)));
        assertThat(runtime.snapshot().participants())
                .extracting(Participant::name).contains("Rinominato");

        runtime.select(prima);
        assertThat(runtime.snapshot().participants())
                .extracting(Participant::name).doesNotContain("Rinominato");
        assertThat(seconda).isNotEqualTo(prima);
    }

    /** Un'asta scritta prima della separazione ricade sulla configurazione generale. */
    @Test
    void unAstaSenzaPartecipantiPropriUsaQuelliGenerali() throws Exception {
        String vecchia = "2026-08-30";
        Path dir = tmp.resolve("auctions").resolve(vecchia);
        Files.createDirectories(dir);
        Files.writeString(dir.resolve("events.jsonl"),
                "{\"type\":\"AuctionStarted\",\"seq\":1,\"at\":\"2026-08-30T08:00:00Z\"}\n");

        runtime.select(vecchia);

        assertThat(runtime.snapshot().participants()).isEqualTo(PARTICIPANTS);
    }

    /**
     * Il caso che conta davvero: un'asta esistente con eventi dentro non deve mai
     * essere aperta credendo di crearne una nuova, ne' vedersi toccare il log.
     */
    @Test
    void unaNuovaAstaNonScriveMaiDentroLaDirectoryDiUnaEsistente() throws Exception {
        String oggi = LocalDate.now().toString();
        Path esistente = tmp.resolve("auctions").resolve(oggi);
        Files.createDirectories(esistente);
        Path log = esistente.resolve("events.jsonl");
        Files.writeString(log, "{\"type\":\"PlayerPurchased\",\"seq\":1,"
                + "\"at\":\"2026-09-01T08:39:00Z\",\"playerId\":\"d1\","
                + "\"participantId\":\"me\",\"price\":6}\n");
        String prima = Files.readString(log);

        String nuovo = runtime.createNew("prova");

        assertThat(nuovo).isNotEqualTo(oggi);
        assertThat(Files.readString(log)).isEqualTo(prima);
        assertThat(runtime.auctions()).extracting(AuctionRuntime.AuctionSummary::id)
                .contains(oggi, nuovo);
    }

    @Test
    void riprendereUnAstaNeApreIlLogSenzaModificarlo() throws Exception {
        String oggi = LocalDate.now().toString();
        Path esistente = tmp.resolve("auctions").resolve(oggi);
        Files.createDirectories(esistente);
        Path log = esistente.resolve("events.jsonl");
        Files.writeString(log, "{\"type\":\"PhaseAdvanced\",\"seq\":1,"
                + "\"at\":\"2026-09-01T08:39:00Z\",\"role\":\"D\"}\n"
                + "{\"type\":\"PlayerPurchased\",\"seq\":2,\"at\":\"2026-09-01T08:40:00Z\","
                + "\"playerId\":\"d1\",\"participantId\":\"me\",\"price\":6}\n");
        String prima = Files.readString(log);

        runtime.select(oggi);

        assertThat(Files.readString(log)).isEqualTo(prima);
        assertThat(runtime.snapshot().auctionId()).isEqualTo(oggi);
        assertThat(runtime.auctions()).singleElement().satisfies(summary -> {
            assertThat(summary.purchases()).isEqualTo(1);
            assertThat(summary.phase()).isEqualTo(Role.D);
            assertThat(summary.selected()).isTrue();
        });
    }

    @Test
    void selezionareUnAstaInesistenteVieneRifiutato() {
        assertThatThrownBy(() -> runtime.select("mai-vista"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("nessuna asta");
    }

    @Test
    void cambiareAstaNonPerdeIlLogDiQuellaLasciata() throws Exception {
        String prima = runtime.createNew("prova");
        Path logPrima = tmp.resolve("auctions").resolve(prima).resolve("events.jsonl");
        long righePrima = Files.readAllLines(logPrima).size();

        // Seconda asta creata a mano per non dipendere dal calendario.
        Path seconda = tmp.resolve("auctions").resolve("altra");
        Files.createDirectories(seconda);
        Files.writeString(seconda.resolve("events.jsonl"), "");
        runtime.select("altra");

        assertThat(runtime.snapshot().auctionId()).isEqualTo("altra");
        assertThat(Files.readAllLines(logPrima)).hasSize((int) righePrima);
    }

    @Test
    void laRicostruzioneNonCambiaAstaSelezionata() {
        String id = runtime.createNew("prova");
        ValuationChain prima = runtime.snapshot().chain();

        runtime.rebuild();

        assertThat(runtime.snapshot().auctionId()).isEqualTo(id);
        assertThat(runtime.snapshot().chain()).isNotSameAs(prima);
    }

    /** Rinominare aggiunge un evento: il nome nuovo vale, il registro non si riscrive. */
    @Test
    void rinominareUnAstaCambiaIlNomeSenzaRiscrivereIlRegistro() throws Exception {
        String id = runtime.createNew("Prima");
        Path log = tmp.resolve("auctions").resolve(id).resolve("events.jsonl");
        String primaRiga = Files.readAllLines(log).getFirst();

        runtime.rename(id, "  Seconda  ");

        assertThat(runtime.currentAuctionLabel()).isEqualTo("Seconda");
        assertThat(runtime.auctions()).extracting(AuctionRuntime.AuctionSummary::label)
                .containsExactly("Seconda");
        assertThat(Files.readAllLines(log)).hasSize(2).first().isEqualTo(primaRiga);
    }

    /** Anche un'asta non aperta si rinomina, e l'asta aperta resta quella. */
    @Test
    void rinominareUnAstaChiusaNonCambiaQuellaAperta() {
        String chiusa = runtime.createNew("Chiusa");
        runtime.deselect();
        String aperta = runtime.createNew("Aperta");

        runtime.rename(chiusa, "Rinominata");

        assertThat(runtime.snapshot().auctionId()).isEqualTo(aperta);
        assertThat(runtime.labelOf(chiusa)).isEqualTo("Rinominata");
    }

    @Test
    void rinominareUnAstaInesistenteVieneRifiutato() {
        assertThatThrownBy(() -> runtime.rename("inventata", "Nome"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    /** La copia ha le regole e i partecipanti dell'originale, nessun acquisto, e non si apre. */
    @Test
    void duplicareCopiaLeImpostazioniSenzaAcquistiESenzaAprirla() {
        String originale = runtime.createNew("Lega");
        runtime.snapshot().store().appendWithNextSeq(seq ->
                new com.fantaagent.domain.auction.AuctionEvent.PlayerPurchased(
                        seq, java.time.Instant.now(), "d1", "me", 10));

        String copia = runtime.duplicate(originale, "Lega (copia)");

        assertThat(copia).isNotEqualTo(originale);
        assertThat(runtime.snapshot().auctionId()).isEqualTo(originale);
        AuctionRuntime.AuctionSummary summary = runtime.auctions().stream()
                .filter(a -> a.id().equals(copia)).findFirst().orElseThrow();
        assertThat(summary.label()).isEqualTo("Lega (copia)");
        assertThat(summary.purchases()).isZero();
        assertThat(archive.participants(copia)).contains(PARTICIPANTS);
        assertThat(archive.rules(copia)).isEqualTo(archive.rules(originale));
    }

    /**
     * La riga della home dice squadre, crediti e posti totali, e i crediti rimasti di
     * chi usa l'app: un acquisto annullato non conta, uno corretto conta col prezzo
     * nuovo e per il nuovo acquirente.
     */
    @Test
    void ilRiepilogoDiceLaLegaEICreditiRimasti() {
        runtime.createNew("Lega");
        var store = runtime.snapshot().store();
        var now = java.time.Instant.now();
        store.appendWithNextSeq(seq -> new com.fantaagent.domain.auction.AuctionEvent
                .PlayerPurchased(seq, now, "a", "me", 10));
        var annullato = store.appendWithNextSeq(seq -> new com.fantaagent.domain.auction
                .AuctionEvent.PlayerPurchased(seq, now, "b", "me", 30));
        store.appendWithNextSeq(seq -> new com.fantaagent.domain.auction.AuctionEvent
                .PurchaseRevoked(seq, now, annullato.seq()));
        var corretto = store.appendWithNextSeq(seq -> new com.fantaagent.domain.auction
                .AuctionEvent.PlayerPurchased(seq, now, "c", "marco", 5));
        store.appendWithNextSeq(seq -> new com.fantaagent.domain.auction.AuctionEvent
                .PurchaseCorrected(seq, now, corretto.seq(), "me", 7));

        AuctionRuntime.AuctionSummary summary = runtime.auctions().getFirst();

        assertThat(summary.teams()).isEqualTo(2);
        assertThat(summary.budget()).isEqualTo(template.rules.budget());
        int slots = template.rules.slots().values().stream().mapToInt(Integer::intValue).sum();
        assertThat(summary.totalSlots()).isEqualTo(2 * slots);
        assertThat(summary.myName()).isEqualTo("Io");
        assertThat(summary.myBudgetRemaining()).isEqualTo(template.rules.budget() - 17);
    }

    /** Partire da un'asta: ne legge nome e impostazioni, senza aprirla ne' toccarla. */
    @Test
    void setupOfLeggeLeImpostazioniDiUnAstaSenzaAprirla() {
        String vecchia = runtime.createNew("Lega vecchia");
        runtime.deselect();

        AuctionSetup setup = runtime.setupOf(vecchia);

        assertThat(setup.name()).isEqualTo("Lega vecchia");
        assertThat(setup.participants()).isEqualTo(PARTICIPANTS);
        assertThat(setup.rules()).isEqualTo(template.rules);
        assertThat(runtime.hasAuction()).isFalse();
    }
}
