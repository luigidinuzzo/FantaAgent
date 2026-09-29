package com.fantaagent.application.service.auction;

import com.fantaagent.application.port.out.AuctionRepository;
import com.fantaagent.application.port.out.ConcurrentAppendException;
import com.fantaagent.application.port.out.Seat;
import com.fantaagent.application.port.out.Transactions;

import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Le scritture di un'asta, una alla volta. Lettura del registro, controlli e INSERT
 * stanno nella stessa transazione, dietro il lock della riga dell'asta: chi arriva
 * secondo aspetta e poi legge uno stato che contiene gia' la scrittura del primo.
 *
 * <p>Senza questo, due rilanci nello stesso istante si scontrerebbero sul numero di
 * sequenza e uno dovrebbe riprovare; con molte scritture fitte, qualcuno riproverebbe
 * piu' volte di fila e perderebbe. La chiave primaria e la rivalidazione di
 * {@code AuctionService} restano come rete, per chi scrivesse senza passare di qui.
 *
 * @param seenSeats i posti con cui la vista che ha aperto questa scrittura e' stata
 *                  costruita: {@link #write} li confronta con quelli veri, dietro lo
 *                  stesso lock, prima di lasciar passare il lavoro
 */
public record AuctionWriteLock(Transactions tx, AuctionRepository repository, UUID auctionId,
                               List<Seat> seenSeats) {

    public AuctionWriteLock {
        seenSeats = List.copyOf(seenSeats);
    }

    public <T> T write(Supplier<T> work) {
        return tx.inTransaction(() -> {
            repository.lockForWrite(auctionId);
            // I posti possono essere cambiati (ordine, membro entrato o uscito) da quando la
            // vista e' stata costruita: LeagueAuctionService.replaceSeats/removeMember
            // prendono lo stesso lock prima di scrivere, quindi qui il confronto vede sempre
            // l'ultima verita'. Scrivere contro partecipanti superati sarebbe peggio che
            // rifiutare: chi tiene questa vista la ricostruisce e riprova, come per ogni
            // altro conflitto di scrittura sul registro.
            List<Seat> current = repository.seats(auctionId);
            if (!current.equals(seenSeats)) {
                throw new ConcurrentAppendException(0, null);
            }
            return work.get();
        });
    }
}
