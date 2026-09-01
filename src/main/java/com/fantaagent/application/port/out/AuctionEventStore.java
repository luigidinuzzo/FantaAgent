package com.fantaagent.application.port.out;

import com.fantaagent.domain.auction.AuctionEvent;

import java.util.List;
import java.util.function.LongFunction;

public interface AuctionEventStore {

    /** Appende l'evento e ne garantisce la persistenza prima di ritornare. */
    void append(AuctionEvent event);

    List<AuctionEvent> load();

    /** Numero di sequenza da assegnare al prossimo evento. Parte da 1. */
    long nextSeq();

    /**
     * Assegna il prossimo seq e appende l'evento che {@code eventFactory} costruisce
     * a partire da quel seq, come una singola operazione. Due chiamate a
     * {@link #nextSeq()} seguite da {@link #append}, non protette da un unico lock,
     * potrebbero calcolare lo stesso seq per due scritture in overlap — l'ultimo
     * append vincerebbe silenziosamente sull'altro nella proiezione, che chiave le
     * mappe sul seq. L'implementazione predefinita non è atomica (va bene per un
     * finto store di test a thread singolo); {@link com.fantaagent.adapter.out.file.JsonlAuctionEventStore}
     * la sovrascrive per essere davvero atomica.
     *
     * @return l'evento appeso, seq incluso
     */
    default AuctionEvent appendWithNextSeq(LongFunction<AuctionEvent> eventFactory) {
        AuctionEvent event = eventFactory.apply(nextSeq());
        append(event);
        return event;
    }

    /** Copia di sicurezza del log. Chiamata a ogni cambio di fase. */
    void backup(String label);
}
