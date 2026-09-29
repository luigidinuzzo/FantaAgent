package com.fantaagent.application.service.importing;

import com.fantaagent.application.port.out.AuctionEventStore;
import com.fantaagent.application.port.out.AuctionEventStores;
import com.fantaagent.application.port.out.AuctionRecord;
import com.fantaagent.application.port.out.AuctionRepository;
import com.fantaagent.application.port.out.ImportedAuction;
import com.fantaagent.application.port.out.ImportedAuctionReader;
import com.fantaagent.application.port.out.LeagueMember;
import com.fantaagent.application.port.out.LeagueRepository;
import com.fantaagent.application.port.out.Seat;
import com.fantaagent.application.port.out.Transactions;
import com.fantaagent.application.service.auction.LogSummary;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.league.Participant;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Porta nella lega un'asta giocata col jar di prima.
 *
 * <p>Tutto o niente: asta, posti, eventi e verifica stanno nella stessa transazione.
 * Se la verifica trova una differenza, la transazione si annulla e nel database non
 * resta nulla — anche il registro, che e' append-only per chi scrive ma non per un
 * ROLLBACK di righe mai confermate.
 *
 * <p>Gli eventi mantengono numero e data. Chi li firma e' l'amministratore che importa:
 * e' lui che li ha messi qui, e una firma inventata sarebbe peggio di una vera.
 */
public class AuctionImportService {

    private final ImportedAuctionReader reader;
    private final AuctionRepository auctions;
    private final AuctionEventStores stores;
    private final LeagueRepository leagues;
    private final Transactions tx;

    public AuctionImportService(ImportedAuctionReader reader, AuctionRepository auctions,
                                AuctionEventStores stores, LeagueRepository leagues, Transactions tx) {
        this.reader = reader;
        this.auctions = auctions;
        this.stores = stores;
        this.leagues = leagues;
        this.tx = tx;
    }

    public ImportPreview preview(LeagueAccess access, Map<String, byte[]> files) {
        access.requireAdmin();
        ImportedAuction a = reader.read(files);
        return new ImportPreview(a.name(), LogSummary.purchases(a.events()), a.participants().stream()
                .map(p -> new ImportPreview.FileParticipant(p.id(), p.name(), String.valueOf(p.initial())))
                .toList());
    }

    public UUID importAuction(LeagueAccess access, Map<String, byte[]> files, Map<String, UUID> mapping) {
        access.requireAdmin();
        ImportedAuction a = reader.read(files);
        validate(access, a, mapping);

        UUID id = UUID.randomUUID();
        List<Seat> seats = new ArrayList<>();
        for (Participant p : a.participants()) {
            seats.add(new Seat(mapping.get(p.id()), p.name(), p.initial(), seats.size() + 1));
        }
        AuctionRecord record = new AuctionRecord(id, access.leagueId(), a.name(), access.userId(),
                a.events().getFirst().at(), null, a.rules(), a.scoring(), a.bidder());
        List<AuctionEvent> rewritten = a.events().stream().map(e -> rewrite(e, mapping)).toList();

        tx.run(() -> {
            auctions.insert(record, seats);
            AuctionEventStore store = stores.open(id, access.userId());
            rewritten.forEach(store::append);
            ImportCheck.verify(a.events(), store.load(), mapping);
        });
        return id;
    }

    private void validate(LeagueAccess access, ImportedAuction a, Map<String, UUID> mapping) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        if (a.events().isEmpty()) {
            errors.put("files", List.of("Il registro dell'asta è vuoto."));
        }
        Set<String> known = a.participants().stream().map(Participant::id).collect(Collectors.toSet());
        boolean strangers = a.events().stream().anyMatch(e -> switch (e) {
            case AuctionEvent.PlayerPurchased p -> !known.contains(p.participantId());
            case AuctionEvent.PurchaseCorrected c -> !known.contains(c.newParticipantId());
            default -> false;
        });
        if (strangers) {
            errors.put("files", List.of("Il registro nomina partecipanti che non sono fra quelli dell'asta."));
        }
        Set<UUID> members = leagues.members(access.leagueId()).stream()
                .map(LeagueMember::userId).collect(Collectors.toSet());
        List<String> problems = new ArrayList<>();
        Set<UUID> used = new HashSet<>();
        for (Participant p : a.participants()) {
            UUID member = mapping.get(p.id());
            if (member == null) {
                problems.add("Abbina «" + p.name() + "» a un membro della lega.");
            } else if (!members.contains(member)) {
                problems.add("Chi hai scelto per «" + p.name() + "» non è un membro della lega.");
            } else if (!used.add(member)) {
                problems.add("Due partecipanti non possono andare allo stesso membro.");
            }
        }
        if (!problems.isEmpty()) {
            errors.put("mapping", List.copyOf(new java.util.LinkedHashSet<>(problems)));
        }
        if (!errors.isEmpty()) {
            throw new InvalidImportException(errors);
        }
    }

    static AuctionEvent rewrite(AuctionEvent e, Map<String, UUID> mapping) {
        return switch (e) {
            case AuctionEvent.PlayerPurchased p -> new AuctionEvent.PlayerPurchased(p.seq(), p.at(), p.playerId(),
                    mapping.get(p.participantId()).toString(), p.price(), p.requestId());
            case AuctionEvent.PurchaseCorrected c -> new AuctionEvent.PurchaseCorrected(c.seq(), c.at(),
                    c.targetSeq(), mapping.get(c.newParticipantId()).toString(), c.newPrice());
            default -> e;
        };
    }
}
