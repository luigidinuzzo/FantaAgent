package com.fantaagent.adapter.out.jdbc;

import com.fantaagent.testsupport.SharedPostgres;
import com.fantaagent.testsupport.TestRows;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Le garanzie che lo schema da' da solo, a prescindere dal codice che lo usa: il
 * registro non si riscrive, non si svuota, non accetta due eventi con lo stesso
 * numero ne' due volte la stessa richiesta.
 */
class SchemaTest {

    private JdbcClient jdbc;
    private UUID admin;
    private UUID auction;

    @BeforeEach
    void setUp() {
        jdbc = JdbcClient.create(SharedPostgres.migratedDatabase());
        admin = TestRows.user(jdbc, "admin@example.com");
        UUID league = TestRows.league(jdbc, admin);
        auction = TestRows.auction(jdbc, league, admin);
    }

    private int insertEvent(long seq, String requestId) {
        return jdbc.sql("""
                        INSERT INTO auction_event (auction_id, seq, at, type, payload, request_id, actor_id)
                        VALUES (:a, :seq, :at, 'PhaseAdvanced', CAST('{}' AS jsonb), :r, :actor)
                        """)
                .param("a", auction).param("seq", seq).param("at", Timestamp.from(Instant.now()))
                .param("r", requestId).param("actor", admin)
                .update();
    }

    @Test
    void unEventoScrittoNonSiAggiorna() {
        insertEvent(1, null);
        assertThatThrownBy(() -> jdbc.sql("UPDATE auction_event SET type = 'X'").update())
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("append-only");
    }

    @Test
    void unEventoScrittoNonSiCancella() {
        insertEvent(1, null);
        assertThatThrownBy(() -> jdbc.sql("DELETE FROM auction_event").update())
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("append-only");
    }

    @Test
    void ilRegistroNonSiSvuota() {
        insertEvent(1, null);
        assertThatThrownBy(() -> jdbc.sql("TRUNCATE auction_event CASCADE").update())
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("append-only");
    }

    @Test
    void dueEventiNonHannoLoStessoNumero() {
        insertEvent(1, null);
        assertThatThrownBy(() -> insertEvent(1, null)).isInstanceOf(DuplicateKeyException.class);
    }

    @Test
    void laStessaRichiestaNonSiScriveDueVolte() {
        insertEvent(1, "r-1");
        assertThatThrownBy(() -> insertEvent(2, "r-1"))
                .isInstanceOf(DuplicateKeyException.class)
                .hasMessageContaining("auction_event_request_key");
    }

    @Test
    void piuEventiSenzaRichiestaConvivono() {
        insertEvent(1, null);
        insertEvent(2, null);
        assertThat(jdbc.sql("SELECT count(*) FROM auction_event").query(Integer.class).single())
                .isEqualTo(2);
    }

    @Test
    void lEmailNonDistingueMaiuscole() {
        assertThatThrownBy(() -> TestRows.user(jdbc, "ADMIN@example.com"))
                .isInstanceOf(DuplicateKeyException.class);
    }

    /**
     * «Le mie leghe» e la chiusura dei link di un utente cercano per utente: la chiave
     * di league_member comincia dalla lega, e user_token non ne ha una per utente.
     */
    @Test
    void leRicerchePerUtenteHannoUnIndice() {
        assertThat(indexedColumns("league_member")).contains("user_id");
        assertThat(indexedColumns("user_token")).contains("user_id");
    }

    /** Le colonne che aprono un indice della tabella: sono quelle che l'indice aiuta a cercare. */
    private java.util.List<String> indexedColumns(String table) {
        return jdbc.sql("""
                        SELECT a.attname
                        FROM pg_index i
                        JOIN pg_class t ON t.oid = i.indrelid
                        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = i.indkey[0]
                        WHERE t.relname = :t
                        """)
                .param("t", table)
                .query(String.class).list();
    }
}
