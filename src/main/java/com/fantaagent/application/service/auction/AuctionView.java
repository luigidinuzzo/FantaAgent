package com.fantaagent.application.service.auction;

import com.fantaagent.application.port.out.AuctionRecord;
import com.fantaagent.application.service.AuctionService;
import com.fantaagent.application.service.PlayerAnalysisService;
import com.fantaagent.application.service.PlayerSearchService;
import com.fantaagent.application.service.ValuationChain;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;

import java.util.List;
import java.util.Optional;

/**
 * Un'asta come la vede una persona, per la durata di una richiesta.
 *
 * <p>I servizi dentro sono quelli di sempre, istanziati su questo scope: leggono lo
 * stato dal registro dell'asta dell'URL, con i partecipanti in cui {@code me} e' il
 * posto di chi chiede. Per questo nessun endpoint puo' valutare "per il posto X": il
 * posto non e' un parametro, e' una proprieta' di questa vista.
 *
 * @param mySeat il posto di chi guarda; vuoto se e' membro della lega ma non gioca
 *               quest'asta
 */
public record AuctionView(AuctionRecord auction, LeagueAccess access, List<Participant> participants,
                          LeagueRules rules, ValuationChain chain, Optional<String> mySeat,
                          AuctionService service, PlayerAnalysisService analysis,
                          PlayerSearchService search, AuctionWriteLock lock) {

    /** @throws NoSeatException se chi guarda non ha un posto: senza posto, niente consigli */
    public String requireSeat() {
        return mySeat.orElseThrow(NoSeatException::new);
    }

    /** Ogni scrittura nel registro passa di qui: in fila con le altre sulla stessa asta. */
    public <T> T write(java.util.function.Supplier<T> work) {
        return lock.write(work);
    }
}
