package com.fantaagent.application.service;

import com.fantaagent.application.port.out.AuctionEventStore;
import com.fantaagent.domain.league.Participant;

import java.util.List;

/**
 * L'asta su cui una richiesta sta lavorando: il suo identificatore, il suo log e i
 * partecipanti con cui va proiettato.
 *
 * <p>È un blocco unico apposta. {@link AuctionService} lo legge una volta sola per
 * operazione: leggere separatamente "lo store corrente" e "i partecipanti correnti"
 * permetterebbe, nell'istante di un cambio, di piegare il log di un'asta sui
 * partecipanti di un'altra.
 */
public record AuctionScope(String auctionId, AuctionEventStore store,
                           List<Participant> participants) {

    public AuctionScope {
        participants = List.copyOf(participants);
    }
}
