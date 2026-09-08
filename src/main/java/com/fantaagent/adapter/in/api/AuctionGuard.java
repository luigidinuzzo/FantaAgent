package com.fantaagent.adapter.in.api;

import com.fantaagent.application.service.AuctionService;
import org.springframework.stereotype.Component;

/**
 * Risolve il segmento {@code {auctionId}} delle rotte, come {@link LeagueGuard} fa
 * con la lega.
 *
 * <p>Esiste perche' quel segmento era decorativo: nessun endpoint lo guardava, e
 * {@code /auctions/pippo/state} rispondeva allegramente con l'asta aperta. La
 * specifica promette che i sotto-progetti 2 e 3 potranno innestare l'indirizzamento
 * vero "senza cambiare le URL ne' una riga di frontend", e un segmento che il
 * server scarta non mantiene quella promessa: renderlo reale piu' tardi sarebbe un
 * cambio di comportamento silenzioso, senza un test che lo veda.
 *
 * <p>Oltre all'identificativo dell'asta aperta si accetta il letterale riservato
 * {@code corrente}, che significa "qualunque asta sia aperta". Non e' una comodita':
 * e' l'unico modo che il frontend ha di partire, perche' alla prima richiesta non
 * conosce ancora nessun identificativo — lo apprende dalla risposta di
 * {@code /state}. La riserva sparisce nel sotto-progetto 2, quando le aste saranno
 * indirizzabili e il client potra' sceglierne una per nome prima di chiamare.
 */
@Component
public class AuctionGuard {

    /** Nessuna asta puo' chiamarsi cosi': gli identificativi reali sono date. */
    public static final String CURRENT = "corrente";

    private final AuctionService auction;

    public AuctionGuard(AuctionService auction) {
        this.auction = auction;
    }

    public void check(String candidate) {
        if (CURRENT.equals(candidate)) {
            return;
        }
        // Il confronto interroga il servizio solo per un candidato concreto: su
        // "corrente" chiedere quale asta sia aperta farebbe fallire con 409 una
        // richiesta che il chiamante ha formulato proprio per non doverlo sapere.
        if (!auction.auctionId().equals(candidate)) {
            throw new UnknownAuctionException(candidate);
        }
    }
}
