package com.fantaagent.application.service.importing;

import com.fantaagent.adapter.out.importing.FileImportReader;
import com.fantaagent.application.service.auction.AuctionCard;
import com.fantaagent.application.service.league.AdminOnlyException;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Role;
import com.fantaagent.testsupport.Fixtures;
import com.fantaagent.testsupport.OldAuctionFiles;
import com.fantaagent.testsupport.PortalWorld;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AuctionImportServiceTest {

    private static final Instant AT = Instant.parse("2025-08-30T20:00:00Z");

    @TempDir
    Path dir;

    private PortalWorld world;
    private AuctionImportService imports;
    private LeagueAccess admin;
    private UUID bruno;
    private Map<String, byte[]> files;

    @BeforeEach
    void setUp() {
        world = new PortalWorld();
        imports = new AuctionImportService(new FileImportReader(Fixtures.template()), world.auctionRepository,
                world.stores, world.leagueRepository, world.tx);
        admin = world.league("anna", "bruno");
        bruno = world.userId(admin, "bruno FC");
        files = OldAuctionFiles.write(dir, List.of(
                        new Participant("me", "Io", 'I', true),
                        new Participant("p2", "Marco", 'M', false)),
                List.of(new AuctionEvent.AuctionStarted(1, AT, "Asta del 2025"),
                        new AuctionEvent.PlayerPurchased(2, AT, "P1", "me", 30),
                        new AuctionEvent.PlayerPurchased(3, AT, "D1", "p2", 45),
                        new AuctionEvent.PurchaseCorrected(4, AT, 2, "me", 35),
                        new AuctionEvent.PhaseAdvanced(5, AT, Role.D)));
    }

    @Test
    void ilRiepilogoDiceNomePartecipantiEAcquisti() {
        ImportPreview preview = imports.preview(admin, files);
        assertThat(preview.name()).isEqualTo("Asta del 2025");
        assertThat(preview.purchases()).isEqualTo(2);
        assertThat(preview.participants()).extracting(ImportPreview.FileParticipant::name)
                .containsExactly("Io", "Marco");
    }

    @Test
    void lAstaImportataEQuellaDiPrimaConIMembriAlPostoDeiNomi() {
        UUID id = imports.importAuction(admin, files, Map.of("me", admin.userId(), "p2", bruno));

        AuctionCard card = world.auctions.list(world.as(admin, bruno)).getFirst();
        assertThat(card.id()).isEqualTo(id);
        assertThat(card.name()).isEqualTo("Asta del 2025");
        assertThat(card.purchases()).isEqualTo(2);
        assertThat(card.phase()).isEqualTo(Role.D);
        assertThat(card.myBudgetRemaining()).isEqualTo(card.budget() - 45);
        assertThat(world.stores.open(id, admin.userId()).load()).extracting(AuctionEvent::seq)
                .containsExactly(1L, 2L, 3L, 4L, 5L);
        assertThat(world.stores.open(id, admin.userId()).load().get(1).at()).isEqualTo(AT);
    }

    @Test
    void senzaUnAbbinamentoCompletoNonSiScriveNiente() {
        assertThatThrownBy(() -> imports.importAuction(admin, files, Map.of("me", admin.userId())))
                .isInstanceOfSatisfying(InvalidImportException.class,
                        e -> assertThat(e.errors()).containsKey("mapping"));
        assertThat(world.auctions.list(admin)).isEmpty();
    }

    @Test
    void dueNomiNonVannoAlloStessoMembro() {
        assertThatThrownBy(() -> imports.importAuction(admin, files, Map.of("me", bruno, "p2", bruno)))
                .isInstanceOf(InvalidImportException.class);
    }

    @Test
    void soloMembriDellaLega() {
        UUID stranger = world.user("estraneo");
        assertThatThrownBy(() -> imports.importAuction(admin, files, Map.of("me", admin.userId(), "p2", stranger)))
                .isInstanceOf(InvalidImportException.class);
    }

    @Test
    void soloLAmministratoreImporta() {
        assertThatThrownBy(() -> imports.preview(world.as(admin, bruno), files))
                .isInstanceOf(AdminOnlyException.class);
    }

    @Test
    void unRegistroIllegibileLoDice() {
        Map<String, byte[]> broken = new HashMap<>(files);
        broken.put("events.jsonl", "non e' json".getBytes(StandardCharsets.UTF_8));
        assertThatThrownBy(() -> imports.preview(admin, broken))
                .isInstanceOfSatisfying(InvalidImportException.class,
                        e -> assertThat(e.errors()).containsKey("files"));
    }

    @Test
    void senzaRegistroNonCeUnAsta() {
        Map<String, byte[]> noLog = new HashMap<>(files);
        noLog.remove("events.jsonl");
        assertThatThrownBy(() -> imports.preview(admin, noLog)).isInstanceOf(InvalidImportException.class);
    }
}
