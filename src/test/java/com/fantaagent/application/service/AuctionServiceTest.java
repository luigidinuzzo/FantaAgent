package com.fantaagent.application.service;

import com.fantaagent.adapter.out.file.InMemoryPlayerCatalog;
import com.fantaagent.adapter.out.file.JsonlAuctionEventStore;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AuctionServiceTest {

    @TempDir
    Path tmp;

    private static final LeagueRules RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static final List<Participant> PARTICIPANTS = List.of(
            new Participant("me", "Io", 'I', true),
            new Participant("marco", "Marco", 'M', false));

    private final PlayerCatalog catalog = new InMemoryPlayerCatalog(List.of(
            new Player("gk", "Portiere", "Inter", Role.P, 10),
            new Player("gk2", "Portiere2", "Roma", Role.P, 8),
            new Player("def", "Difensore", "Inter", Role.D, 20)), List.of());

    private AuctionService service;

    @BeforeEach
    void setUp() {
        service = new AuctionService(RULES, PARTICIPANTS, catalog,
                new JsonlAuctionEventStore(tmp.resolve("events.jsonl")));
    }

    @Test
    void startsInTheFirstPhaseWithFullBudgets() {
        assertThat(service.state().currentPhase()).isEqualTo(Role.P);
        assertThat(service.state().mySquad().budgetRemaining()).isEqualTo(100);
        assertThat(service.salesInCurrentPhase()).isZero();
    }

    @Test
    void recordsAPurchaseAndPersistsIt() {
        service.recordPurchase("gk", "marco", 30);

        assertThat(service.state().squadOf("marco").spent()).isEqualTo(30);

        AuctionService reloaded = new AuctionService(RULES, PARTICIPANTS, catalog,
                new JsonlAuctionEventStore(tmp.resolve("events.jsonl")));
        assertThat(reloaded.state().squadOf("marco").spent()).isEqualTo(30);
    }

    @Test
    void countsSalesInTheCurrentPhaseOnly() {
        service.recordPurchase("gk", "marco", 30);
        assertThat(service.salesInCurrentPhase()).isEqualTo(1);

        service.advancePhase();
        assertThat(service.state().currentPhase()).isEqualTo(Role.D);
        assertThat(service.salesInCurrentPhase()).isZero();
    }

    @Test
    void undoRemovesTheLastPurchase() {
        service.recordPurchase("gk", "marco", 30);
        service.recordPurchase("gk2", "me", 25);

        assertThat(service.undoLast()).isTrue();

        assertThat(service.state().mySquad().spent()).isZero();
        assertThat(service.state().squadOf("marco").spent()).isEqualTo(30);
        assertThat(service.state().soldPlayerIds()).containsExactly("gk");
    }

    @Test
    void undoOnAnEmptyLogReportsThatThereIsNothingToUndo() {
        assertThat(service.undoLast()).isFalse();
    }

    @Test
    void rejectsAnUnknownPlayer() {
        assertThatThrownBy(() -> service.recordPurchase("nessuno", "me", 10))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("sconosciuto");
    }

    @Test
    void rejectsAPlayerAlreadySold() {
        service.recordPurchase("gk", "marco", 30);

        assertThatThrownBy(() -> service.recordPurchase("gk", "me", 40))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("già");
    }

    @Test
    void rejectsAPriceAboveTheBuyersRemainingBudget() {
        assertThatThrownBy(() -> service.recordPurchase("gk", "me", 101))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("budget");
    }

    @Test
    void rejectsAPurchaseForAnAlreadyFullRole() {
        service.recordPurchase("gk", "me", 10);

        assertThatThrownBy(() -> service.recordPurchase("gk2", "me", 10))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("slot");
    }

    @Test
    void reportsNothingToResumeOnAFreshAuction() {
        assertThat(service.resumeSummary()).isEmpty();
    }

    /**
     * S6: il banner deve significare "trovato già in corso sul log all'avvio", non
     * "esiste almeno un holding". Un servizio costruito sopra un log che ha già
     * acquisti — il caso reale di un riavvio dell'app a metà asta — deve riportarlo;
     * lo stesso acquisto fatto DENTRO questa sessione (vedi il test sotto) non deve.
     */
    @Test
    void reportsAnAuctionAlreadyInProgressWhenConstructedOverAnExistingLog() {
        AuctionService fresh = new AuctionService(RULES, PARTICIPANTS, catalog,
                new JsonlAuctionEventStore(tmp.resolve("events.jsonl")));
        fresh.recordPurchase("gk", "marco", 30);

        AuctionService resumed = new AuctionService(RULES, PARTICIPANTS, catalog,
                new JsonlAuctionEventStore(tmp.resolve("events.jsonl")));

        assertThat(resumed.resumeSummary()).hasValueSatisfying(summary -> {
            assertThat(summary.purchases()).isEqualTo(1);
            assertThat(summary.phase()).isEqualTo(Role.P);
        });
    }

    @Test
    void theResumeBannerIsAbsentAfterAPurchaseMadeInThisSession() {
        service.recordPurchase("gk", "marco", 30);

        assertThat(service.resumeSummary()).isEmpty();
    }

    @Test
    void theResumeBannerIsAbsentAfterAnUndoMadeInThisSession() {
        AuctionService resumed = new AuctionService(RULES, PARTICIPANTS, catalog,
                new JsonlAuctionEventStore(tmp.resolve("events.jsonl")));
        resumed.recordPurchase("gk", "marco", 30);
        AuctionService resumedAgain = new AuctionService(RULES, PARTICIPANTS, catalog,
                new JsonlAuctionEventStore(tmp.resolve("events.jsonl")));
        assertThat(resumedAgain.resumeSummary()).isPresent();

        resumedAgain.undoLast();

        assertThat(resumedAgain.resumeSummary()).isEmpty();
    }

    @Test
    void backsUpTheLogBeforeChangingPhase() {
        service.recordPurchase("gk", "marco", 30);

        service.advancePhase();

        assertThat(tmp.resolve("events-fine-P.jsonl.bak")).exists();
    }

    @Test
    void revokePurchaseRemovesASpecificPurchaseNotNecessarilyTheLast() {
        // A differenza di undoLast, che raggiunge solo l'ultimo: qui si rimuove
        // "gk" (il primo) mentre "gk2" (comprato dopo) resta intatto.
        service.recordPurchase("gk", "marco", 30);
        service.recordPurchase("gk2", "me", 25);
        long targetSeq = service.state().squadOf("marco").holdings().getFirst().seq();

        service.revokePurchase(targetSeq);

        assertThat(service.state().squadOf("marco").spent()).isZero();
        assertThat(service.state().squadOf("me").spent()).isEqualTo(25);
        assertThat(service.state().soldPlayerIds()).containsExactly("gk2");
    }

    @Test
    void revokePurchaseRejectsASeqThatDoesNotIdentifyAnExistingPurchase() {
        assertThatThrownBy(() -> service.revokePurchase(999L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("nessun acquisto");
    }

    @Test
    void revokePurchaseRejectsAPurchaseAlreadyRevoked() {
        service.recordPurchase("gk", "marco", 30);
        long targetSeq = service.state().squadOf("marco").holdings().getFirst().seq();
        service.revokePurchase(targetSeq);

        assertThatThrownBy(() -> service.revokePurchase(targetSeq))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("già annullato");
    }

    @Test
    void resolvesParticipantsByInitial() {
        assertThat(service.byInitial('m')).contains(PARTICIPANTS.get(1));
        assertThat(service.byInitial('Z')).isEmpty();
        assertThat(service.me().id()).isEqualTo("me");
    }
}
