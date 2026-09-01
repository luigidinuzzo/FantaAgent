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

    private AuctionArchive archive;
    private AuctionRuntime runtime;

    private static ScoringRules scoring() {
        Map<Role, Double> bonus = new EnumMap<>(Role.class);
        for (Role role : Role.values()) {
            bonus.put(role, 3.0);
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
        runtime = new AuctionRuntime(RULES, catalog, List.of(1.0),
                AuctionRuntimeTest::scoring, () -> PARTICIPANTS, archive);
    }

    @Test
    void allAvvioNessunAstaESelezionata() {
        assertThat(runtime.hasAuction()).isFalse();
        assertThat(runtime.auctions()).isEmpty();
    }

    @Test
    void creaUnAstaSottoUnIdentificativoDatato() {
        String id = runtime.createNew();

        assertThat(id).isEqualTo(LocalDate.now().toString());
        assertThat(runtime.hasAuction()).isTrue();
        assertThat(runtime.snapshot().auctionId()).isEqualTo(id);
        assertThat(tmp.resolve("auctions").resolve(id).resolve("events.jsonl")).exists();
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

        String nuovo = runtime.createNew();

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
        String prima = runtime.createNew();
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
        String id = runtime.createNew();
        ValuationChain prima = runtime.snapshot().chain();

        runtime.rebuild();

        assertThat(runtime.snapshot().auctionId()).isEqualTo(id);
        assertThat(runtime.snapshot().chain()).isNotSameAs(prima);
    }
}
