package com.fantaagent.application.service.auction;

import com.fantaagent.application.port.out.AuctionEventStores;
import com.fantaagent.application.port.out.AuctionRecord;
import com.fantaagent.application.port.out.AuctionRepository;
import com.fantaagent.application.port.out.LeagueMember;
import com.fantaagent.application.port.out.LeagueRepository;
import com.fantaagent.application.port.out.Seat;
import com.fantaagent.application.port.out.Transactions;
import com.fantaagent.application.service.league.AdminCannotLeaveException;
import com.fantaagent.application.service.league.InvalidLeagueDataException;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.application.service.league.LeagueService;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.player.Role;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Le aste di una lega viste dall'esterno: crearle, elencarle, rinominarle,
 * cancellarle, sistemarne i posti. Cio' che succede DENTRO un'asta — acquisti, fasi,
 * valutazioni — passa da {@link AuctionRegistry}.
 */
public class LeagueAuctionService {

    static final int MAX_NAME = 60;
    /** I posti sotto cui un'asta non si legge piu': le regole ne vogliono almeno due. */
    private static final int MIN_SEATS = 2;

    private final AuctionRepository auctions;
    private final LeagueRepository leagues;
    private final AuctionEventStores stores;
    private final Transactions tx;
    private final Clock clock;
    private final List<Role> phases;

    public LeagueAuctionService(AuctionRepository auctions, LeagueRepository leagues,
                                AuctionEventStores stores, Transactions tx, Clock clock, List<Role> phases) {
        this.auctions = auctions;
        this.leagues = leagues;
        this.stores = stores;
        this.tx = tx;
        this.clock = clock;
        this.phases = List.copyOf(phases);
    }

    /**
     * I posti sono i membri di adesso, in ordine d'ingresso nella lega: e' il turno di
     * chiamata di partenza, che l'amministratore puo' cambiare. Asta, posti ed evento di
     * avvio nella stessa transazione: un'asta senza registro non comparirebbe mai
     * iniziata, uno senza posti non si potrebbe giocare.
     */
    public AuctionRecord create(LeagueAccess access, String name) {
        access.requireAdmin();
        String clean = cleanName(name);
        List<LeagueMember> members = leagues.members(access.leagueId());
        if (members.size() < 2) {
            throw new NotEnoughMembersException();
        }
        List<Seat> seats = new ArrayList<>();
        for (int i = 0; i < members.size(); i++) {
            LeagueMember m = members.get(i);
            seats.add(new Seat(m.userId(), m.teamName(), m.initial(), i + 1));
        }
        Instant now = clock.instant();
        AuctionRecord auction = new AuctionRecord(UUID.randomUUID(), access.leagueId(), clean,
                access.userId(), now, null, access.league().rules(), access.league().scoring(),
                access.league().bidder());
        tx.run(() -> {
            auctions.insert(auction, seats);
            stores.open(auction.id(), access.userId())
                    .append(new AuctionEvent.AuctionStarted(1, now, clean));
        });
        return auction;
    }

    /** Quante aste ha la lega, senza aprirne i registri: per l'elenco delle leghe. */
    public int count(LeagueAccess access) {
        return auctions.byLeague(access.leagueId()).size();
    }

    public List<AuctionCard> list(LeagueAccess access) {
        List<AuctionCard> cards = new ArrayList<>();
        String me = access.userId().toString();
        for (AuctionRecord a : auctions.byLeague(access.leagueId())) {
            List<AuctionEvent> events = stores.open(a.id(), access.userId()).load();
            List<Seat> seats = auctions.seats(a.id());
            int slotsPerTeam = a.rules().slots().values().stream().mapToInt(Integer::intValue).sum();
            boolean seated = seats.stream().anyMatch(s -> s.userId().equals(access.userId()));
            cards.add(new AuctionCard(a.id(), a.name(), a.createdAt(), LogSummary.lastWritten(events),
                    LogSummary.purchases(events), LogSummary.phase(events, phases.getFirst()),
                    seats.size(), a.rules().budget(), seats.size() * slotsPerTeam,
                    seated ? a.rules().budget() - LogSummary.spentBy(events, me) : null, a.bidder()));
        }
        return List.copyOf(cards);
    }

    /** @throws AuctionNotFoundException se non esiste, e' cancellata o e' di un'altra lega */
    public AuctionRecord find(LeagueAccess access, UUID auctionId) {
        return auctions.byId(auctionId)
                .filter(a -> a.leagueId().equals(access.leagueId()))
                .filter(a -> a.deletedAt() == null)
                .orElseThrow(() -> new AuctionNotFoundException(auctionId));
    }

    public void rename(LeagueAccess access, UUID auctionId, String name) {
        access.requireAdmin();
        find(access, auctionId);
        auctions.rename(auctionId, cleanName(name));
    }

    public void updateBidder(LeagueAccess access, UUID auctionId, AuctionSettings bidder) {
        access.requireAdmin();
        find(access, auctionId);
        auctions.updateBidder(auctionId, bidder);
    }

    public void delete(LeagueAccess access, UUID auctionId) {
        access.requireAdmin();
        find(access, auctionId);
        auctions.softDelete(auctionId, clock.instant());
    }

    public List<Seat> seats(LeagueAccess access, UUID auctionId) {
        find(access, auctionId);
        return auctions.seats(auctionId);
    }

    public boolean seatsLocked(LeagueAccess access, UUID auctionId) {
        find(access, auctionId);
        return LogSummary.anyPurchase(stores.open(auctionId, access.userId()).load());
    }

    public List<Seat> replaceSeats(LeagueAccess access, UUID auctionId, List<SeatRequest> requested) {
        access.requireAdmin();
        find(access, auctionId);
        Set<UUID> members = leagues.members(access.leagueId()).stream()
                .map(LeagueMember::userId).collect(Collectors.toSet());
        List<Seat> wanted = new ArrayList<>();
        Set<UUID> seen = new HashSet<>();
        Set<Character> initials = new HashSet<>();
        for (SeatRequest r : requested) {
            Map<String, List<String>> problems = LeagueService.memberProblems(r.teamName(), r.initial(), true);
            if (!problems.isEmpty()) {
                throw new InvalidLeagueDataException(problems);
            }
            if (r.userId() == null || !members.contains(r.userId()) || !seen.add(r.userId())) {
                throw new InvalidLeagueDataException(Map.of("seats",
                        List.of("Ogni posto va a un membro diverso della lega.")));
            }
            char initial = LeagueService.initialOf(r.initial());
            if (!initials.add(initial)) {
                throw new InvalidLeagueDataException(Map.of("seats",
                        List.of("Due posti non possono avere la stessa iniziale: " + initial + ".")));
            }
            wanted.add(new Seat(r.userId(), r.teamName().trim(), initial, wanted.size() + 1));
        }
        if (wanted.size() < 2) {
            throw new NotEnoughMembersException();
        }
        // Il controllo "posti bloccati" e la scrittura vanno dietro lo stesso lock di riga
        // che AuctionWriteLock usa per gli acquisti: senza, un acquisto in corso potrebbe
        // leggere posti che stanno per sparire, o questo cambio posti ignorare un acquisto
        // appena registrato che li avrebbe bloccati.
        return tx.inTransaction(() -> {
            auctions.lockForWrite(auctionId);
            if (seatsLocked(access, auctionId) && !sameSeatsIgnoringOrder(auctions.seats(auctionId), wanted)) {
                throw new SeatsLockedException();
            }
            auctions.replaceSeats(auctionId, wanted);
            return auctions.seats(auctionId);
        });
    }

    /**
     * Lasciare la lega (se {@code userId} e' chi chiede) o toglierne un membro (se e'
     * l'amministratore). Nelle aste dove si e' gia' comprato il posto resta — una rosa
     * pagata non sparisce; in quelle ancora da iniziare si toglie.
     */
    public void removeMember(LeagueAccess access, UUID userId) {
        if (userId.equals(access.userId())) {
            if (access.isAdmin()) {
                throw new AdminCannotLeaveException();
            }
        } else {
            access.requireAdmin();
        }
        tx.run(() -> {
            // auctionsWithSeat torna le aste in un ordine fisso (per identificativo): con
            // piu' aste da bloccare in sequenza, due removeMember concorrenti su aste in
            // comune devono prenderle sempre nello stesso ordine, altrimenti l'una
            // aspetterebbe la riga che l'altra ha gia' bloccato e viceversa — un deadlock.
            for (UUID auctionId : auctions.auctionsWithSeat(access.leagueId(), userId)) {
                // Stesso motivo di replaceSeats: il lock impedisce che questa rimozione e un
                // acquisto sulla stessa asta si scavalchino.
                auctions.lockForWrite(auctionId);
                // Il posto resta anche se l'asta, senza di lui, avrebbe un posto solo: le
                // regole ne vogliono almeno due, e da li' ogni lettura dell'asta
                // fallirebbe. Chi esce dalla lega esce comunque; i posti li sistema
                // l'amministratore dalle impostazioni dell'asta.
                boolean wouldBeAlone = auctions.seats(auctionId).size() <= MIN_SEATS;
                if (!wouldBeAlone && !LogSummary.anyPurchase(stores.open(auctionId, access.userId()).load())) {
                    auctions.removeSeat(auctionId, userId);
                }
            }
            leagues.deleteMember(access.leagueId(), userId);
        });
    }

    private static boolean sameSeatsIgnoringOrder(List<Seat> current, List<Seat> wanted) {
        record Key(UUID userId, String teamName, char initial) {
        }
        Set<Key> a = current.stream().map(s -> new Key(s.userId(), s.teamName(), s.initial()))
                .collect(Collectors.toSet());
        Set<Key> b = wanted.stream().map(s -> new Key(s.userId(), s.teamName(), s.initial()))
                .collect(Collectors.toSet());
        return current.size() == wanted.size() && a.equals(b);
    }

    private static String cleanName(String name) {
        String clean = name == null ? "" : name.trim();
        if (clean.isEmpty()) {
            throw new InvalidLeagueDataException(Map.of("name", List.of(
                    "Dai un nome all'asta: serve a riconoscerla nell'elenco.")));
        }
        if (clean.length() > MAX_NAME) {
            throw new InvalidLeagueDataException(Map.of("name", List.of(
                    "Il nome dell'asta non può superare " + MAX_NAME + " caratteri.")));
        }
        return clean;
    }
}
