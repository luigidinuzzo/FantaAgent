package com.fantaagent.application.service.auction;

import com.fantaagent.application.port.out.AuctionEventStore;
import com.fantaagent.application.port.out.AuctionEventStores;
import com.fantaagent.application.port.out.AuctionRecord;
import com.fantaagent.application.port.out.AuctionRepository;
import com.fantaagent.application.port.out.AuctionTemplate;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.application.port.out.Seat;
import com.fantaagent.application.port.out.Transactions;
import com.fantaagent.application.service.AuctionScope;
import com.fantaagent.application.service.AuctionService;
import com.fantaagent.application.service.PlayerAnalysisService;
import com.fantaagent.application.service.PlayerSearchService;
import com.fantaagent.application.service.ValuationChain;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Role;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Prende il posto di {@code AuctionRuntime} per l'API: non c'e' piu' "l'asta
 * selezionata" del processo, c'e' l'asta dell'URL, ricostruita per chi la chiede.
 *
 * <p><b>Cosa si ricalcola e cosa no.</b> Stato e posti si rileggono a ogni richiesta:
 * sono qualche centinaio di righe, e cosi' nessuna cache puo' divergere dal registro.
 * La {@link ValuationChain} no: proiettare l'intero catalogo costa, e la catena
 * dipende solo da regole e punteggio dell'asta — fissi dalla creazione — e dal numero
 * di squadre. Se ne tiene una per (asta, squadre), e quando i posti cambiano prima
 * dell'inizio la chiave cambia con loro.
 *
 * <p><b>Atomicita'.</b> Ogni vista e' un oggetto nuovo e immutabile, costruito per
 * intero prima di essere usato: la garanzia di {@code AuctionRuntime} — chi legge vede
 * tutto il vecchio o tutto il nuovo — vale per costruzione, senza campi volatili.
 */
public class AuctionRegistry {

    static final int MAX_CHAINS = 32;

    private record ChainKey(UUID auctionId, int teams) {
    }

    private final LeagueAuctionService auctions;
    private final AuctionRepository repository;
    private final AuctionEventStores stores;
    private final PlayerCatalog catalog;
    private final AuctionTemplate template;
    private final List<Double> seasonWeights;
    private final List<Role> phases;
    private final Transactions tx;

    /** Accesso solo sotto il lock dell'istanza: LinkedHashMap in ordine d'accesso non e' thread-safe. */
    private final Map<ChainKey, ValuationChain> chains = new LinkedHashMap<>(16, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<ChainKey, ValuationChain> eldest) {
            return size() > MAX_CHAINS;
        }
    };

    public AuctionRegistry(LeagueAuctionService auctions, AuctionRepository repository,
                           AuctionEventStores stores, PlayerCatalog catalog, AuctionTemplate template,
                           List<Double> seasonWeights, List<Role> phases, Transactions tx) {
        this.auctions = auctions;
        this.repository = repository;
        this.stores = stores;
        this.catalog = catalog;
        this.template = template;
        this.seasonWeights = List.copyOf(seasonWeights);
        this.phases = List.copyOf(phases);
        this.tx = tx;
    }

    /** @throws AuctionNotFoundException se l'asta non e' della lega o e' cancellata */
    public AuctionView view(LeagueAccess access, UUID auctionId) {
        AuctionRecord auction = auctions.find(access, auctionId);
        UUID viewer = access.userId();
        List<Seat> seats = repository.seats(auctionId).stream()
                .sorted(Comparator.comparingInt(Seat::position)).toList();
        List<Participant> participants = seats.stream()
                .map(s -> new Participant(s.userId().toString(), s.teamName(), s.initial(),
                        s.userId().equals(viewer)))
                .toList();
        Optional<String> mySeat = seats.stream().anyMatch(s -> s.userId().equals(viewer))
                ? Optional.of(viewer.toString())
                : Optional.empty();

        LeagueRules rules = auction.rules().toRules(participants.size(), phases);
        ValuationChain chain = chainFor(auction, rules);
        AuctionEventStore store = stores.open(auctionId, viewer);
        AuctionScope scope = new AuctionScope(auctionId.toString(), store, participants, rules);
        AuctionService service = new AuctionService(catalog, () -> scope);
        PlayerAnalysisService analysis = new PlayerAnalysisService(catalog, () -> chain, service);
        PlayerSearchService search = new PlayerSearchService(catalog, () -> chain, service, analysis);
        return new AuctionView(auction, access, participants, rules, chain, mySeat, service, analysis, search,
                new AuctionWriteLock(tx, repository, auctionId));
    }

    private synchronized ValuationChain chainFor(AuctionRecord auction, LeagueRules rules) {
        return chains.computeIfAbsent(new ChainKey(auction.id(), rules.participants()),
                key -> ValuationChain.build(rules, template.scoringRules(auction.scoring()),
                        catalog, seasonWeights));
    }
}
