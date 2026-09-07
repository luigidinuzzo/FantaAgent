package com.fantaagent.application.service;

import com.fantaagent.application.port.out.AuctionEventStore;
import com.fantaagent.domain.auction.AuctionEvent;

import java.util.ArrayList;
import java.util.List;

class InMemoryEventStore implements AuctionEventStore {

    private final List<AuctionEvent> events = new ArrayList<>();

    @Override
    public void append(AuctionEvent event) {
        events.add(event);
    }

    @Override
    public List<AuctionEvent> load() {
        return List.copyOf(events);
    }

    @Override
    public long nextSeq() {
        return events.size() + 1L;
    }

    @Override
    public void backup(String label) {
    }
}
