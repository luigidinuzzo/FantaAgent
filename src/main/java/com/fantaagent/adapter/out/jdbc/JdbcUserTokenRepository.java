package com.fantaagent.adapter.out.jdbc;

import com.fantaagent.application.port.out.UserToken;
import com.fantaagent.application.port.out.UserTokenRepository;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static com.fantaagent.adapter.out.jdbc.Columns.instant;
import static com.fantaagent.adapter.out.jdbc.Columns.ts;

public class JdbcUserTokenRepository implements UserTokenRepository {

    private final JdbcClient jdbc;

    public JdbcUserTokenRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void insert(UserToken t) {
        jdbc.sql("""
                        INSERT INTO user_token (id, user_id, purpose, token_hash, created_at, expires_at, used_at)
                        VALUES (:id, :user, :purpose, :hash, :created, :expires, :used)
                        """)
                .param("id", t.id()).param("user", t.userId()).param("purpose", t.purpose().name())
                .param("hash", t.tokenHash()).param("created", ts(t.createdAt()))
                .param("expires", ts(t.expiresAt())).param("used", ts(t.usedAt()))
                .update();
    }

    @Override
    public Optional<UserToken> byHash(String tokenHash) {
        return jdbc.sql("""
                        SELECT id, user_id, purpose, token_hash, created_at, expires_at, used_at
                        FROM user_token WHERE token_hash = :hash
                        """)
                .param("hash", tokenHash).query(JdbcUserTokenRepository::map).optional();
    }

    @Override
    public boolean markUsed(UUID id, Instant at) {
        return jdbc.sql("UPDATE user_token SET used_at = :at WHERE id = :id AND used_at IS NULL")
                .param("at", ts(at)).param("id", id).update() == 1;
    }

    private static UserToken map(ResultSet rs, int row) throws SQLException {
        return new UserToken(rs.getObject("id", UUID.class), rs.getObject("user_id", UUID.class),
                UserToken.Purpose.valueOf(rs.getString("purpose")), rs.getString("token_hash"),
                instant(rs.getTimestamp("created_at")), instant(rs.getTimestamp("expires_at")),
                instant(rs.getTimestamp("used_at")));
    }
}
