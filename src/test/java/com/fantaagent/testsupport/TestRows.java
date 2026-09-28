package com.fantaagent.testsupport;

import org.springframework.jdbc.core.simple.JdbcClient;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

/**
 * Righe minime per soddisfare le chiavi esterne nei test degli adattatori, scritte in
 * SQL invece che con i repository: un test del registro non deve dipendere dal codice
 * che crea utenti e leghe.
 */
public final class TestRows {

    static final String RULES = """
            {"budget":500,"slots":{"P":3,"D":8,"C":8,"A":6}}""";

    private TestRows() {
    }

    public static UUID user(JdbcClient jdbc, String email) {
        UUID id = UUID.randomUUID();
        jdbc.sql("""
                        INSERT INTO app_user (id, email, password_hash, display_name, created_at)
                        VALUES (:id, :email, 'x', :name, :at)
                        """)
                .param("id", id).param("email", email).param("name", email.split("@")[0])
                .param("at", Timestamp.from(Instant.now()))
                .update();
        return id;
    }

    public static UUID league(JdbcClient jdbc, UUID adminId) {
        UUID id = UUID.randomUUID();
        jdbc.sql("""
                        INSERT INTO league (id, name, created_by, created_at, rules, scoring, bidder)
                        VALUES (:id, 'Lega di prova', :admin, :at, CAST(:rules AS jsonb),
                                CAST('{}' AS jsonb), CAST('{"bidTimerSeconds":5,"beepEnabled":true}' AS jsonb))
                        """)
                .param("id", id).param("admin", adminId).param("at", Timestamp.from(Instant.now()))
                .param("rules", RULES)
                .update();
        return id;
    }

    public static UUID auction(JdbcClient jdbc, UUID leagueId, UUID adminId) {
        UUID id = UUID.randomUUID();
        jdbc.sql("""
                        INSERT INTO auction (id, league_id, name, created_by, created_at, rules, scoring, bidder)
                        VALUES (:id, :league, 'Asta di prova', :admin, :at, CAST(:rules AS jsonb),
                                CAST('{}' AS jsonb), CAST('{"bidTimerSeconds":5,"beepEnabled":true}' AS jsonb))
                        """)
                .param("id", id).param("league", leagueId).param("admin", adminId)
                .param("at", Timestamp.from(Instant.now())).param("rules", RULES)
                .update();
        return id;
    }
}
