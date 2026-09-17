package com.fantaagent.application.service;

import com.fantaagent.adapter.out.file.FileAuctionArchive;
import com.fantaagent.adapter.out.file.InMemoryPlayerCatalog;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AuctionRuntimePerAuctionTest {

    @TempDir
    Path tmp;

    private TestAuctionTemplate template;
    private FileAuctionArchive archive;
    private AuctionRuntime runtime;

    @BeforeEach
    void setUp() {
        template = new TestAuctionTemplate(AuctionRuntimeTest.scoringSettings());
        archive = new FileAuctionArchive(tmp);
        runtime = new AuctionRuntime(
                new InMemoryPlayerCatalog(List.of(new Player("d1", "Difensore", "Inter", Role.D, 20)), List.of()),
                List.of(1.0), List.of(Role.P, Role.D, Role.C, Role.A), template, archive);
    }

    private AuctionSetup setup(String name, int budget, List<Participant> people, int timer) {
        return new AuctionSetup(name,
                new LeagueRulesSettings(budget, Map.of(Role.P, 1, Role.D, 2, Role.C, 1, Role.A, 1)),
                people, template.scoring, new AuctionSettings(timer, false));
    }

    private static List<Participant> people(int n) {
        return java.util.stream.IntStream.range(0, n)
                .mapToObj(i -> new Participant("p" + i, "Nome" + i, (char) ('A' + i), i == 0))
                .toList();
    }

    @Test
    void creareScriveICinqueFileNellaCartellaDellAsta() {
        String id = runtime.createNew(setup("Prima", 300, people(3), 9));
        Path dir = tmp.resolve("auctions").resolve(id);
        assertThat(dir.resolve("events.jsonl")).exists();
        assertThat(dir.resolve("league-members.yml")).exists();
        assertThat(dir.resolve("league-settings.yml")).exists();
        assertThat(dir.resolve("league-rules.yml")).exists();
        assertThat(dir.resolve("auction-settings.yml")).exists();
    }

    @Test
    void ogniAstaHaLeSueRegoleESquadrePariAiPartecipanti() {
        String prima = runtime.createNew(setup("Prima", 300, people(3), 9));
        String seconda = runtime.createNew(setup("Seconda", 700, people(5), 20));

        runtime.select(prima);
        assertThat(runtime.rules().budget()).isEqualTo(300);
        assertThat(runtime.rules().participants()).isEqualTo(3);
        assertThat(runtime.rules().slots(Role.D)).isEqualTo(2);
        assertThat(runtime.bidder()).isEqualTo(new AuctionSettings(9, false));
        assertThat(runtime.snapshot().chain()).isNotNull();

        runtime.select(seconda);
        assertThat(runtime.rules().budget()).isEqualTo(700);
        assertThat(runtime.rules().participants()).isEqualTo(5);
        assertThat(runtime.bidder().bidTimerSeconds()).isEqualTo(20);
    }

    @Test
    void unAstaVecchiaRicadeSulModello() throws Exception {
        Path dir = tmp.resolve("auctions").resolve("2026-08-30");
        Files.createDirectories(dir);
        Files.writeString(dir.resolve("events.jsonl"),
                "{\"type\":\"AuctionStarted\",\"seq\":1,\"at\":\"2026-08-30T08:00:00Z\"}\n");

        runtime.select("2026-08-30");

        assertThat(runtime.rules().budget()).isEqualTo(100);
        assertThat(runtime.rules().participants()).isEqualTo(2);
        assertThat(runtime.bidder()).isEqualTo(AuctionSettings.DEFAULTS);
    }

    @Test
    void creareNonToccaIlModello() {
        var modello = template.rules;
        runtime.createNew(setup("Prima", 300, people(3), 9));
        runtime.deselect();
        assertThat(template.rules).isSameAs(modello);
        assertThat(runtime.rules().budget()).isEqualTo(100);
    }

    /** Il registro per ultimo: un errore prima lascia una cartella che la home non elenca. */
    @Test
    void seUnFilePrimaDelRegistroFallisceLAstaNonCompareNellElenco() {
        var broken = setup("Rotta", 300, people(3), 9);
        var failing = new FileAuctionArchive(tmp) {
            @Override
            public void saveBidder(String auctionId, AuctionSettings settings) {
                throw new java.io.UncheckedIOException(new java.io.IOException("disco pieno"));
            }
        };
        var rt = new AuctionRuntime(new InMemoryPlayerCatalog(List.of(), List.of()), List.of(1.0),
                List.of(Role.P, Role.D, Role.C, Role.A), template, failing);

        assertThatThrownBy(() -> rt.createNew(broken)).isInstanceOf(java.io.UncheckedIOException.class);
        assertThat(rt.auctions()).isEmpty();
        assertThat(rt.hasAuction()).isFalse();
    }

    @Test
    void setBidderScriveNellAstaApertaERipubblica() {
        String id = runtime.createNew(setup("Prima", 300, people(3), 9));
        runtime.setBidder(new AuctionSettings(15, true));
        assertThat(runtime.bidder()).isEqualTo(new AuctionSettings(15, true));
        assertThat(archive.bidder(id)).contains(new AuctionSettings(15, true));
    }

    @Test
    void setBidderSenzaAstaVieneRifiutato() {
        assertThatThrownBy(() -> runtime.setBidder(AuctionSettings.DEFAULTS))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void cancellareLAstaApertaPrimaLaChiude() {
        String id = runtime.createNew(setup("Prima", 300, people(3), 9));
        runtime.delete(id);
        assertThat(runtime.hasAuction()).isFalse();
        assertThat(runtime.auctions()).isEmpty();
        assertThat(tmp.resolve("auctions-cestino")).isDirectoryContaining(p ->
                p.getFileName().toString().startsWith(id + "-"));
    }

    @Test
    void cancellareUnAltraAstaLasciaApertaQuellaCorrente() {
        String prima = runtime.createNew(setup("Prima", 300, people(3), 9));
        String seconda = runtime.createNew(setup("Seconda", 300, people(3), 9));
        runtime.delete(prima);
        assertThat(runtime.currentAuctionId()).isEqualTo(seconda);
    }

    @Test
    void cancellareUnAstaInesistenteVieneRifiutato() {
        assertThatThrownBy(() -> runtime.delete("nessuna")).isInstanceOf(IllegalArgumentException.class);
    }

    /** /legacy crea ancora con il solo nome: dal modello. */
    @Test
    void creareColSoloNomeUsaIlModello() {
        String id = runtime.createNew("Legacy");
        assertThat(runtime.rules().budget()).isEqualTo(100);
        assertThat(archive.rules(id)).contains(template.rules);
    }
}
