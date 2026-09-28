package com.fantaagent.testsupport;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.flywaydb.core.Flyway;

import javax.sql.DataSource;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Un solo Postgres incorporato per tutta la JVM dei test, e un database nuovo per chi
 * lo chiede.
 *
 * <p>Un processo per contesto Spring sarebbe il modo piu' semplice, ma i test web
 * hanno contesti diversi l'uno dall'altro (ogni combinazione di {@code @MockitoBean}
 * ne crea uno) e la cache di Spring li tiene vivi tutti: decine di Postgres accesi.
 * Un database per chiamata da' lo stesso isolamento con un processo solo.
 */
public final class SharedPostgres {

    private static final AtomicInteger COUNTER = new AtomicInteger();
    private static EmbeddedPostgres server;

    private SharedPostgres() {
    }

    private static synchronized EmbeddedPostgres server() {
        if (server == null) {
            try {
                server = EmbeddedPostgres.start();
            } catch (IOException e) {
                throw new UncheckedIOException("Postgres incorporato non avviato", e);
            }
            EmbeddedPostgres started = server;
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                try {
                    started.close();
                } catch (IOException ignored) {
                    // la JVM sta finendo: non c'e' nessuno a cui dirlo
                }
            }));
        }
        return server;
    }

    /** Un database vuoto, dal nome mai usato prima in questa JVM. */
    public static DataSource freshDatabase() {
        String name = "t" + ProcessHandle.current().pid() + "_" + COUNTER.incrementAndGet();
        try (Connection c = server().getPostgresDatabase().getConnection();
             Statement s = c.createStatement()) {
            s.execute("CREATE DATABASE " + name);
        } catch (SQLException e) {
            throw new IllegalStateException("database di prova non creato: " + name, e);
        }
        return server().getDatabase("postgres", name);
    }

    /** Un database vuoto con tutte le migrazioni applicate: per i test senza Spring. */
    public static DataSource migratedDatabase() {
        DataSource ds = freshDatabase();
        Flyway.configure().dataSource(ds).locations("classpath:db/migration").load().migrate();
        return ds;
    }
}
