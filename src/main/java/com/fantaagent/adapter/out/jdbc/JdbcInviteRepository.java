package com.fantaagent.adapter.out.jdbc;

import com.fantaagent.application.port.out.Invite;
import com.fantaagent.application.port.out.InviteRepository;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static com.fantaagent.adapter.out.jdbc.Columns.instant;
import static com.fantaagent.adapter.out.jdbc.Columns.ts;

public class JdbcInviteRepository implements InviteRepository {

    private static final String COLUMNS =
            "id, league_id, token_hash, created_by, created_at, expires_at, revoked_at";

    private final JdbcClient jdbc;

    public JdbcInviteRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void insert(Invite i) {
        jdbc.sql("INSERT INTO league_invite (" + COLUMNS + ") VALUES (:id, :league, :hash, :by, :at, :exp, :rev)")
                .param("id", i.id()).param("league", i.leagueId()).param("hash", i.tokenHash())
                .param("by", i.createdBy()).param("at", ts(i.createdAt())).param("exp", ts(i.expiresAt()))
                .param("rev", ts(i.revokedAt()))
                .update();
    }

    @Override
    public Optional<Invite> byHash(String tokenHash) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM league_invite WHERE token_hash = :hash")
                .param("hash", tokenHash).query(JdbcInviteRepository::map).optional();
    }

    @Override
    public List<Invite> byLeague(UUID leagueId) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM league_invite WHERE league_id = :league ORDER BY created_at DESC")
                .param("league", leagueId).query(JdbcInviteRepository::map).list();
    }

    @Override
    public boolean revoke(UUID leagueId, UUID inviteId, Instant at) {
        return jdbc.sql("""
                        UPDATE league_invite SET revoked_at = :at
                        WHERE id = :id AND league_id = :league AND revoked_at IS NULL
                        """)
                .param("at", ts(at)).param("id", inviteId).param("league", leagueId).update() == 1;
    }

    private static Invite map(ResultSet rs, int row) throws SQLException {
        return new Invite(rs.getObject("id", UUID.class), rs.getObject("league_id", UUID.class),
                rs.getString("token_hash"), rs.getObject("created_by", UUID.class),
                instant(rs.getTimestamp("created_at")), instant(rs.getTimestamp("expires_at")),
                instant(rs.getTimestamp("revoked_at")));
    }
}
