package com.fantaagent.adapter.out.jdbc;

import com.fantaagent.adapter.out.file.event.EventDto;
import com.fantaagent.application.port.out.AuctionEventStore;
import com.fantaagent.application.port.out.ConcurrentAppendException;
import com.fantaagent.application.port.out.DuplicateRequestException;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.sql.Timestamp;
import java.util.List;
import java.util.UUID;

/**
 * Il registro di un'asta su {@code auction_event}.
 *
 * <p>Il lock di {@code JsonlAuctionEventStore} qui non serve e non basterebbe: con
 * piu' richieste, e domani piu' istanze, l'unico arbitro comune e' il database. Due
 * scritture che calcolano lo stesso seq arrivano entrambe alla INSERT; la chiave
 * primaria ne lascia passare una e l'altra diventa {@link ConcurrentAppendException}.
 * Chi scrive decide cosa farne — {@code AuctionService} rilegge e rivalida.
 *
 * <p>Nessuna transazione qui dentro: una INSERT sola e' gia' atomica, e una
 * transazione aperta intorno a un conflitto resterebbe inutilizzabile per il
 * tentativo successivo.
 */
public class JdbcAuctionEventStore implements AuctionEventStore {

    static final String REQUEST_KEY = "auction_event_request_key";

    private final JdbcClient jdbc;
    private final ObjectMapper json;
    private final UUID auctionId;
    private final UUID actorId;

    public JdbcAuctionEventStore(JdbcClient jdbc, ObjectMapper json, UUID auctionId, UUID actorId) {
        this.jdbc = jdbc;
        this.json = json;
        this.auctionId = auctionId;
        this.actorId = actorId;
    }

    @Override
    public void append(AuctionEvent event) {
        EventDto dto = EventDto.from(event);
        try {
            jdbc.sql("""
                            INSERT INTO auction_event (auction_id, seq, at, type, payload, request_id, actor_id)
                            VALUES (:auction, :seq, :at, :type, CAST(:payload AS jsonb), :request, :actor)
                            """)
                    .param("auction", auctionId)
                    .param("seq", event.seq())
                    .param("at", Timestamp.from(event.at()))
                    .param("type", dto.type())
                    .param("payload", write(dto))
                    .param("request", dto.requestId())
                    .param("actor", actorId)
                    .update();
        } catch (DuplicateKeyException e) {
            // Il nome del vincolo e' nel messaggio di Postgres: e' l'unico modo di
            // distinguere "numero gia' preso" da "richiesta gia' vista" senza
            // dipendere dalle classi del driver.
            if (String.valueOf(e.getMessage()).contains(REQUEST_KEY)) {
                throw new DuplicateRequestException(dto.requestId());
            }
            throw new ConcurrentAppendException(event.seq(), e);
        }
    }

    @Override
    public List<AuctionEvent> load() {
        return jdbc.sql("SELECT payload FROM auction_event WHERE auction_id = :auction ORDER BY seq")
                .param("auction", auctionId)
                .query(String.class)
                .list()
                .stream()
                .map(this::read)
                .map(EventDto::toDomain)
                .toList();
    }

    @Override
    public long nextSeq() {
        return jdbc.sql("SELECT coalesce(max(seq), 0) + 1 FROM auction_event WHERE auction_id = :auction")
                .param("auction", auctionId)
                .query(Long.class)
                .single();
    }

    /**
     * Le copie di sicurezza per fase erano la rete del file. Qui la rete e' il backup
     * del database: una copia per ogni cambio di fase, dentro lo stesso database,
     * non proteggerebbe da nulla che il registro append-only non copra gia'.
     */
    @Override
    public void backup(String label) {
    }

    private String write(EventDto dto) {
        try {
            return json.writeValueAsString(dto);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("evento non serializzabile: " + dto.type(), e);
        }
    }

    private EventDto read(String payload) {
        try {
            return json.readValue(payload, EventDto.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("evento illeggibile nel registro " + auctionId, e);
        }
    }
}
