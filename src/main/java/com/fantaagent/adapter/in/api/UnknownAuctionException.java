package com.fantaagent.adapter.in.api;

public class UnknownAuctionException extends RuntimeException {

    public UnknownAuctionException(String auctionId) {
        super("asta sconosciuta: " + auctionId);
    }
}
