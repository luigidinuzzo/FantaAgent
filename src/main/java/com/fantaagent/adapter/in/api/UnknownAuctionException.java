package com.fantaagent.adapter.in.api;

public class UnknownAuctionException extends RuntimeException {

    public UnknownAuctionException(String auctionId) {
        super("asta sconosciuta: " + auctionId);
    }

    /**
     * {@link AuctionsApi#select} converte qui QUALUNQUE {@code IllegalArgumentException}
     * lanciata da {@code AuctionRuntime#select} — non solo quella per un identificativo
     * assente dall'archivio, ma anche un guasto di configurazione vero che
     * {@code ValuationChain.build} puo' lanciare mentre prepara la catena della nuova
     * asta. Scartare la causa renderebbe quel guasto indistinguibile, nei log, da un id
     * semplicemente sbagliato: la si incatena qui perche' resti visibile a chi indaga,
     * anche se la risposta HTTP resta 404 "asta sconosciuta" in entrambi i casi.
     */
    public UnknownAuctionException(String auctionId, Throwable cause) {
        super("asta sconosciuta: " + auctionId, cause);
    }
}
