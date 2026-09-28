package com.fantaagent.adapter.out.jdbc;

import com.fantaagent.application.port.out.EmailTakenException;
import com.fantaagent.application.port.out.UserAccount;
import com.fantaagent.application.port.out.UserRepository;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static com.fantaagent.adapter.out.jdbc.Columns.instant;
import static com.fantaagent.adapter.out.jdbc.Columns.ts;

public class JdbcUserRepository implements UserRepository {

    private static final String COLUMNS =
            "id, email, password_hash, display_name, email_verified_at, created_at";

    private final JdbcClient jdbc;

    public JdbcUserRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void insert(UserAccount user) {
        try {
            jdbc.sql("INSERT INTO app_user (" + COLUMNS + ") VALUES (:id, :email, :hash, :name, :verified, :created)")
                    .param("id", user.id()).param("email", user.email())
                    .param("hash", user.passwordHash()).param("name", user.displayName())
                    .param("verified", ts(user.emailVerifiedAt())).param("created", ts(user.createdAt()))
                    .update();
        } catch (DuplicateKeyException e) {
            throw new EmailTakenException(user.email());
        }
    }

    @Override
    public Optional<UserAccount> byEmail(String email) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM app_user WHERE lower(email) = lower(:email)")
                .param("email", email).query(JdbcUserRepository::map).optional();
    }

    @Override
    public Optional<UserAccount> byId(UUID id) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM app_user WHERE id = :id")
                .param("id", id).query(JdbcUserRepository::map).optional();
    }

    @Override
    public void updatePassword(UUID id, String passwordHash) {
        jdbc.sql("UPDATE app_user SET password_hash = :hash WHERE id = :id")
                .param("hash", passwordHash).param("id", id).update();
    }

    @Override
    public void markVerified(UUID id, Instant at) {
        jdbc.sql("UPDATE app_user SET email_verified_at = coalesce(email_verified_at, :at) WHERE id = :id")
                .param("at", ts(at)).param("id", id).update();
    }

    @Override
    public void updateDisplayName(UUID id, String displayName) {
        jdbc.sql("UPDATE app_user SET display_name = :name WHERE id = :id")
                .param("name", displayName).param("id", id).update();
    }

    private static UserAccount map(ResultSet rs, int row) throws SQLException {
        return new UserAccount(rs.getObject("id", UUID.class), rs.getString("email"),
                rs.getString("password_hash"), rs.getString("display_name"),
                instant(rs.getTimestamp("email_verified_at")), instant(rs.getTimestamp("created_at")));
    }
}
