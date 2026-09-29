package com.fantaagent.application.service.auction;

import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.player.Role;

import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Cio' che l'elenco delle aste legge dal registro senza proiettarlo: la proiezione
 * vuole il catalogo e le regole, e un elenco non deve fallire su un'asta vecchia che
 * nomina un giocatore uscito dal listone.
 *
 * <p>Stessa logica di {@code AuctionRuntime.countPurchases/spentBy/lastPhase}, che
 * restano dove sono per {@code /legacy}.
 */
public final class LogSummary {

    private LogSummary() {
    }

    public static int purchases(List<AuctionEvent> events) {
        Set<Long> revoked = new HashSet<>();
        for (AuctionEvent e : events) {
            if (e instanceof AuctionEvent.PurchaseRevoked r) {
                revoked.add(r.targetSeq());
            }
        }
        int count = 0;
        for (AuctionEvent e : events) {
            if (e instanceof AuctionEvent.PlayerPurchased p && !revoked.contains(p.seq())) {
                count++;
            }
        }
        return count;
    }

    /** Anche uno poi annullato: dal primo acquisto, i posti sono quelli. */
    public static boolean anyPurchase(List<AuctionEvent> events) {
        return events.stream().anyMatch(AuctionEvent.PlayerPurchased.class::isInstance);
    }

    public static int spentBy(List<AuctionEvent> events, String participantId) {
        Map<Long, AuctionEvent.PlayerPurchased> active = new LinkedHashMap<>();
        Map<Long, String> buyer = new HashMap<>();
        Map<Long, Integer> price = new HashMap<>();
        for (AuctionEvent event : events) {
            switch (event) {
                case AuctionEvent.PlayerPurchased p -> {
                    active.put(p.seq(), p);
                    buyer.put(p.seq(), p.participantId());
                    price.put(p.seq(), p.price());
                }
                case AuctionEvent.PurchaseRevoked r -> active.remove(r.targetSeq());
                case AuctionEvent.PurchaseCorrected c -> {
                    if (active.containsKey(c.targetSeq())) {
                        buyer.put(c.targetSeq(), c.newParticipantId());
                        price.put(c.targetSeq(), c.newPrice());
                    }
                }
                default -> {
                    // nome e fasi non spostano crediti
                }
            }
        }
        int spent = 0;
        for (Long seq : active.keySet()) {
            if (participantId.equals(buyer.get(seq))) {
                spent += price.get(seq);
            }
        }
        return spent;
    }

    public static Role phase(List<AuctionEvent> events, Role fallback) {
        Role phase = fallback;
        for (AuctionEvent e : events) {
            if (e instanceof AuctionEvent.PhaseAdvanced advanced) {
                phase = advanced.role();
            }
        }
        return phase;
    }

    public static Instant lastWritten(List<AuctionEvent> events) {
        return events.isEmpty() ? null : events.getLast().at();
    }
}
