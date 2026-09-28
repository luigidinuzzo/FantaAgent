package com.fantaagent.testsupport;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;

import javax.sql.DataSource;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * Il Postgres di {@code ./run.sh}: stessa libreria dei test, ma con i dati in una
 * cartella che sopravvive al riavvio, e su una porta fissa per poterci guardare
 * dentro con un client qualunque.
 */
public final class PersistentPostgres {

    static final int PORT = 54329;
    static final String DATABASE = "fantaagent";

    private PersistentPostgres() {
    }

    public static DataSource start(Path dataDir) {
        try {
            Files.createDirectories(dataDir);
            EmbeddedPostgres pg = EmbeddedPostgres.builder()
                    .setDataDirectory(dataDir)
                    .setCleanDataDirectory(false)
                    .setPort(PORT)
                    .start();
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                try {
                    pg.close();
                } catch (IOException ignored) {
                    // in chiusura
                }
            }));
            try (Connection c = pg.getPostgresDatabase().getConnection();
                 Statement s = c.createStatement()) {
                var rs = s.executeQuery("SELECT 1 FROM pg_database WHERE datname = '" + DATABASE + "'");
                if (!rs.next()) {
                    s.execute("CREATE DATABASE " + DATABASE);
                }
            }
            return pg.getDatabase("postgres", DATABASE);
        } catch (IOException e) {
            throw new UncheckedIOException("Postgres locale non avviato in " + dataDir, e);
        } catch (SQLException e) {
            throw new IllegalStateException("database locale non creato", e);
        }
    }
}
