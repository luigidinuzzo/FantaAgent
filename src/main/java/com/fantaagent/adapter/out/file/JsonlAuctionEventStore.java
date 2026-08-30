package com.fantaagent.adapter.out.file;

import com.fantaagent.adapter.out.file.event.EventDto;
import com.fantaagent.application.port.out.AuctionEventStore;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.List;

/**
 * Log append-only degli eventi d'asta, una riga JSON per evento.
 *
 * <p>Ogni append apre il file, scrive, forza la scrittura su disco e chiude. Aprire il
 * canale a ogni evento costa circa un millisecondo — ben dentro il budget di 100 ms —
 * e in cambio elimina ogni gestione di risorse a lungo termine e ogni rischio di
 * perdere l'ultima riga per un buffer non svuotato.
 */
public class JsonlAuctionEventStore implements AuctionEventStore {

    private static final ObjectMapper MAPPER = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private final Path file;

    public JsonlAuctionEventStore(Path file) {
        this.file = file;
    }

    @Override
    public void append(AuctionEvent event) {
        try {
            Path parent = file.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            String line = MAPPER.writeValueAsString(EventDto.from(event)) + "\n";
            try (FileChannel channel = FileChannel.open(file,
                    StandardOpenOption.CREATE,
                    StandardOpenOption.WRITE,
                    StandardOpenOption.APPEND)) {
                channel.write(ByteBuffer.wrap(line.getBytes(StandardCharsets.UTF_8)));
                channel.force(true);
            }
        } catch (IOException e) {
            throw new UncheckedIOException("impossibile scrivere l'evento su " + file, e);
        }
    }

    @Override
    public List<AuctionEvent> load() {
        if (!Files.exists(file)) {
            return List.of();
        }
        try {
            List<AuctionEvent> events = new ArrayList<>();
            for (String line : Files.readAllLines(file, StandardCharsets.UTF_8)) {
                if (!line.isBlank()) {
                    events.add(MAPPER.readValue(line, EventDto.class).toDomain());
                }
            }
            return List.copyOf(events);
        } catch (IOException e) {
            throw new UncheckedIOException("impossibile leggere il log eventi " + file, e);
        }
    }

    @Override
    public long nextSeq() {
        List<AuctionEvent> events = load();
        return events.isEmpty() ? 1L : events.getLast().seq() + 1L;
    }

    @Override
    public void backup(String label) {
        if (!Files.exists(file)) {
            return;
        }
        try {
            Path target = file.resolveSibling("events-" + label + ".jsonl.bak");
            Files.copy(file, target, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new UncheckedIOException("impossibile creare il backup del log " + file, e);
        }
    }
}
