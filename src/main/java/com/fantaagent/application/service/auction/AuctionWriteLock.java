package com.fantaagent.application.service.auction;

import com.fantaagent.application.port.out.AuctionRepository;
import com.fantaagent.application.port.out.Transactions;

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
 */
public record AuctionWriteLock(Transactions tx, AuctionRepository repository, UUID auctionId) {

    public <T> T write(Supplier<T> work) {
        return tx.inTransaction(() -> {
            repository.lockForWrite(auctionId);
            return work.get();
        });
    }
}
