package com.fantaagent.adapter.out.file;

import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FileAuctionArchiveRulesAndTrashTest {

    @TempDir
    Path data;

    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-09-17T20:15:30Z"), ZoneOffset.UTC);

    private FileAuctionArchive archive() {
        return new FileAuctionArchive(data, CLOCK);
    }

    private void createWithLog(FileAuctionArchive archive, String id) {
        archive.open(id).appendWithNextSeq(seq ->
                new AuctionEvent.AuctionStarted(seq, Instant.parse("2026-09-17T19:00:00Z"), "Prova"));
    }

    @Test
    void regoleEBattitoreSiSalvanoNellaCartellaDellAsta() {
        var archive = archive();
        var rules = new LeagueRulesSettings(300, Map.of(Role.P, 2, Role.D, 6, Role.C, 7, Role.A, 5));
        archive.saveRules("a1", rules);
        archive.saveBidder("a1", new AuctionSettings(12, false));

        assertThat(data.resolve("auctions/a1/league-rules.yml")).exists();
        assertThat(data.resolve("auctions/a1/auction-settings.yml")).exists();
        assertThat(archive.rules("a1")).contains(rules);
        assertThat(archive.bidder("a1")).contains(new AuctionSettings(12, false));
    }

    @Test
    void unAstaVecchiaNonHaNeRegoleNeBattitore() {
        var archive = archive();
        createWithLog(archive, "vecchia");
        assertThat(archive.rules("vecchia")).isEmpty();
        assertThat(archive.bidder("vecchia")).isEmpty();
    }

    @Test
    void lExportSiScriveComeRoseCsvInUtf8() throws Exception {
        var archive = archive();
        createWithLog(archive, "a1");
        archive.saveExport("a1", "Portieri;Sommer\n");
        assertThat(Files.readString(data.resolve("auctions/a1/rose.csv"), StandardCharsets.UTF_8))
                .isEqualTo("Portieri;Sommer\n");
    }

    @Test
    void cancellareSpostaLaCartellaNelCestinoConDataEOra() {
        var archive = archive();
        createWithLog(archive, "a1");

        archive.delete("a1");

        assertThat(data.resolve("auctions/a1")).doesNotExist();
        assertThat(data.resolve("auctions-cestino/a1-20260917-201530/events.jsonl")).exists();
        assertThat(archive.auctionIds()).doesNotContain("a1");
        assertThat(archive.exists("a1")).isFalse();
    }

    @Test
    void cancellareUnAstaInesistenteVieneRifiutato() {
        assertThatThrownBy(() -> archive().delete("nessuna"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void unIdentificativoConPercorsoVieneRifiutatoAncheInCancellazione() {
        assertThatThrownBy(() -> archive().delete("../fuori"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
