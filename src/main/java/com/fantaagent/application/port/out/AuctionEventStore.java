package com.fantaagent.application.port.out;

import com.fantaagent.domain.auction.AuctionEvent;

import java.util.List;

public interface AuctionEventStore {

    /** Appende l'evento e ne garantisce la persistenza prima di ritornare. */
    void append(AuctionEvent event);

    List<AuctionEvent> load();

    /** Numero di sequenza da assegnare al prossimo evento. Parte da 1. */
    long nextSeq();

    /** Copia di sicurezza del log. Chiamata a ogni cambio di fase. */
    void backup(String label);
}
