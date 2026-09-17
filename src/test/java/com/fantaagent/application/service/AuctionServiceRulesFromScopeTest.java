package com.fantaagent.application.service;

import com.fantaagent.adapter.out.file.InMemoryPlayerCatalog;
import com.fantaagent.adapter.out.file.JsonlAuctionEventStore;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Le regole sono dell'asta: il servizio le legge dallo scope a ogni richiesta. Se le
 * catturasse alla costruzione, passare a un'asta con un altro budget lascerebbe i
 * crediti residui calcolati con quello di prima.
 */
class AuctionServiceRulesFromScopeTest {

    @TempDir
    Path tmp;

    private static LeagueRules rules(int budget) {
        return new LeagueRules(2, budget, Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1),
                List.of(Role.P, Role.D, Role.C, Role.A));
    }

    @Test
    void cambiandoScopeCambianoAncheLeRegole() {
        List<Participant> people = List.of(
                new Participant("me", "Io", 'I', true), new Participant("p2", "Tu", 'T', false));
        var store = new JsonlAuctionEventStore(tmp.resolve("events.jsonl"));
        var scope = new AtomicReference<>(new AuctionScope("a", store, people, rules(100)));
        var service = new AuctionService(new InMemoryPlayerCatalog(List.of(), List.of()), scope::get);

        assertThat(service.state().rules().budget()).isEqualTo(100);

        scope.set(new AuctionScope("b", store, people, rules(300)));

        assertThat(service.state().rules().budget()).isEqualTo(300);
    }
}
