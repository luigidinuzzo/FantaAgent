package com.fantaagent.application.port.out;

import java.util.function.Supplier;

/**
 * Piu' scritture che valgono tutte o nessuna. Una porta invece di
 * {@code @Transactional}: i servizi sono classi semplici costruite in
 * {@code config}, senza proxy, e il confine della transazione si vede nel codice.
 */
public interface Transactions {

    <T> T inTransaction(Supplier<T> work);

    default void run(Runnable work) {
        inTransaction(() -> {
            work.run();
            return null;
        });
    }
}
