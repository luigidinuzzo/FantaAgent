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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumMap;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Fissa la proprieta' di atomicita' della ricostruzione: mentre la catena viene
 * ricostruita, nessun lettore concorrente puo' osservare pezzi che non stanno insieme.
 *
 * <p>La proprieta' e' presa da tre lati, perche' un solo test di concorrenza non basta:
 * un test a thread che vanno in corsa dimostra la PRESENZA di una rottura, mai la sua
 * assenza. Qui il valore sta nei primi due controlli, che sono deterministici.
 *
 * <ol>
 *   <li><b>Una catena mescolata non e' rappresentabile</b>: il costruttore canonico di
 *       {@link ValuationChain} rifiuta pezzi che non derivino dalle stesse regole e
 *       dagli stessi livelli di rimpiazzo. Verificato senza concorrenza.</li>
 *   <li><b>Esiste un solo campo mutabile, ed e' volatile</b>: verificato per
 *       riflessione. E' cio' che rende impossibile una pubblicazione a meta': con due
 *       campi mutabili la sequenza "prima le proiezioni, poi il motore" sarebbe
 *       osservabile nel mezzo, e nessun test di concorrenza garantirebbe di beccarla.</li>
 *   <li><b>Sotto corsa vera</b>: lettori in parallelo a ricostruzioni ripetute; ogni
 *       catena osservata deve essere IDENTICA (per identita' di riferimento) a una
 *       delle catene effettivamente pubblicate. Un mescolamento produrrebbe una coppia
 *       proiezioni/motore mai pubblicata insieme, e questo controllo la scarterebbe
 *       senza tolleranze. Che la corsa venga davvero esercitata non e' garantito; che
 *       l'assertion sia esatta, si'.</li>
 * </ol>
 */
class AuctionRuntimeAtomicityTest {

    @TempDir
    Path tmp;

    private static final LeagueRules RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static final List<Participant> PARTICIPANTS = List.of(
            new Participant("me", "Io", 'I', true),
            new Participant("marco", "Marco", 'M', false));

    private static ScoringRules scoring(double goalBonus) {
        Map<Role, Double> bonus = new EnumMap<>(Role.class);
        for (Role role : Role.values()) {
            bonus.put(role, goalBonus);
        }
        return new ScoringRules(true, bonus, 1.0, 3.0, -3.0, 3.0, -0.5, -1.0, -1.0, 1.0,
                new ModifierTable(3, List.of(new ModifierTable.Threshold(0.0, 0.0),
                        new ModifierTable.Threshold(6.0, 1.0))),
                new ModifierTable(0, List.of(new ModifierTable.Threshold(0.0, 0.0))),
                0.55);
    }

    private static PlayerCatalog catalog() {
        List<Player> players = new ArrayList<>();
        for (Role role : Role.values()) {
            for (int i = 0; i < 6; i++) {
                players.add(new Player(role.name() + i, role.name() + " " + i, "Squadra", role, 5 + i));
            }
        }
        return new InMemoryPlayerCatalog(players, List.of());
    }

    @Test
    void unaCatenaMescolataNonSiPuoNemmenoCostruire() {
        PlayerCatalog catalog = catalog();
        ValuationChain vecchia = ValuationChain.build(RULES, scoring(3.0), catalog, List.of(1.0));
        ValuationChain nuova = ValuationChain.build(RULES, scoring(9.0), catalog, List.of(1.0));

        // Proiezioni delle regole nuove col motore costruito su quelle vecchie: e'
        // esattamente il numero verde, plausibile e falso che questo progetto teme.
        assertThatThrownBy(() ->
                new ValuationChain(nuova.scoring(), nuova.projections(), vecchia.engine()))
                .isInstanceOf(IllegalArgumentException.class);

        assertThatThrownBy(() ->
                new ValuationChain(vecchia.scoring(), nuova.projections(), nuova.engine()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void ilRuntimeHaUnSoloCampoMutabileEdEVolatile() {
        List<Field> mutabili = new ArrayList<>();
        for (Field field : AuctionRuntime.class.getDeclaredFields()) {
            if (!Modifier.isStatic(field.getModifiers()) && !Modifier.isFinal(field.getModifiers())) {
                mutabili.add(field);
            }
        }

        assertThat(mutabili)
                .describedAs("un secondo campo mutabile renderebbe osservabile una "
                        + "pubblicazione a meta': tutto lo stato che cambia deve stare "
                        + "dentro l'unico snapshot")
                .hasSize(1);
        assertThat(Modifier.isVolatile(mutabili.getFirst().getModifiers())).isTrue();
        assertThat(mutabili.getFirst().getType()).isEqualTo(RuntimeSnapshot.class);
    }

    @Test
    void iLettoriConcorrentiNonVedonoMaiUnaCatenaMezzaVecchiaEMezzaNuova() throws Exception {
        PlayerCatalog catalog = catalog();
        AuctionArchive archive = new FileAuctionArchive(tmp);
        TestAuctionTemplate template = new TestAuctionTemplate(
                com.fantaagent.config.ScoringSettings.from(scoring(3.0), true));
        template.participants = PARTICIPANTS;

        AuctionRuntime runtime = new AuctionRuntime(catalog, List.of(1.0),
                List.of(Role.P, Role.D, Role.C, Role.A), template, archive);

        // Ogni catena pubblicata, per identita': le uniche combinazioni legittime.
        Set<ValuationChain> pubblicate = Collections.newSetFromMap(new IdentityHashMap<>());
        pubblicate.add(runtime.snapshot().chain());

        AtomicBoolean stop = new AtomicBoolean(false);
        List<Throwable> errori = Collections.synchronizedList(new ArrayList<>());
        CountDownLatch pronti = new CountDownLatch(4);
        List<Thread> lettori = new ArrayList<>();
        List<Set<ValuationChain>> viste = new ArrayList<>();

        for (int i = 0; i < 4; i++) {
            Set<ValuationChain> osservate = Collections.newSetFromMap(new IdentityHashMap<>());
            viste.add(osservate);
            Thread lettore = new Thread(() -> {
                pronti.countDown();
                try {
                    while (!stop.get()) {
                        RuntimeSnapshot snapshot = runtime.snapshot();
                        ValuationChain chain = snapshot.chain();
                        osservate.add(chain);
                        // I pezzi devono appartenere tutti alla stessa catena: un
                        // mescolamento romperebbe queste identita'.
                        if (chain.projections().scoring() != chain.scoring()
                                || chain.engine().modifiers().scoring() != chain.scoring()
                                || chain.engine().modifiers().replacement()
                                        != chain.projections().replacement()) {
                            throw new AssertionError("catena mescolata osservata");
                        }
                    }
                } catch (Throwable t) {
                    errori.add(t);
                }
            });
            lettori.add(lettore);
            lettore.start();
        }

        pronti.await();
        for (int i = 0; i < 200; i++) {
            template.scoring = com.fantaagent.config.ScoringSettings.from(
                    scoring(i % 2 == 0 ? 9.0 : 3.0), true);
            runtime.rebuild();
            pubblicate.add(runtime.snapshot().chain());
        }
        stop.set(true);
        for (Thread lettore : lettori) {
            lettore.join();
        }

        assertThat(errori).isEmpty();
        Set<ValuationChain> osservate = Collections.newSetFromMap(new IdentityHashMap<>());
        viste.forEach(osservate::addAll);
        assertThat(osservate).isNotEmpty();
        // Nessuna catena osservata puo' essere diversa da quelle pubblicate: una
        // pubblicazione a meta' produrrebbe proprio un oggetto che qui non risulta.
        for (ValuationChain chain : osservate) {
            assertThat(pubblicate.contains(chain))
                    .describedAs("catena osservata mai pubblicata dal runtime")
                    .isTrue();
        }
    }
}
