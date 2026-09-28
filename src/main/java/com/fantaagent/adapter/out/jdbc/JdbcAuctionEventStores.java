package com.fantaagent.adapter.out.jdbc;

import com.fantaagent.application.port.out.AuctionEventStore;
import com.fantaagent.application.port.out.AuctionEventStores;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.util.UUID;

public class JdbcAuctionEventStores implements AuctionEventStores {

    private final JdbcClient jdbc;
    private final ObjectMapper json;

    public JdbcAuctionEventStores(JdbcClient jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    @Override
    public AuctionEventStore open(UUID auctionId, UUID actorId) {
        return new JdbcAuctionEventStore(jdbc, json, auctionId, actorId);
    }
}
