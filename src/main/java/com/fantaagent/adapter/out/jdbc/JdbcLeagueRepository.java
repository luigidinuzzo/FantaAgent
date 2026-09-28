package com.fantaagent.adapter.out.jdbc;

import com.fantaagent.application.port.out.InitialTakenException;
import com.fantaagent.application.port.out.League;
import com.fantaagent.application.port.out.LeagueMember;
import com.fantaagent.application.port.out.LeagueRepository;
import com.fantaagent.application.port.out.MemberRole;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.config.ScoringSettings;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static com.fantaagent.adapter.out.jdbc.Columns.fromJson;
import static com.fantaagent.adapter.out.jdbc.Columns.instant;
import static com.fantaagent.adapter.out.jdbc.Columns.json;
import static com.fantaagent.adapter.out.jdbc.Columns.ts;

public class JdbcLeagueRepository implements LeagueRepository {

    private static final String MEMBER_SELECT = """
            SELECT m.league_id, m.user_id, m.role, m.team_name, m.initial, m.joined_at, u.display_name
            FROM league_member m JOIN app_user u ON u.id = m.user_id
            """;

    private final JdbcClient jdbc;
    private final ObjectMapper mapper;

    public JdbcLeagueRepository(JdbcClient jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    @Override
    public void insert(League l) {
        jdbc.sql("""
                        INSERT INTO league (id, name, created_by, created_at, rules, scoring, bidder)
                        VALUES (:id, :name, :by, :at, CAST(:rules AS jsonb), CAST(:scoring AS jsonb),
                                CAST(:bidder AS jsonb))
                        """)
                .param("id", l.id()).param("name", l.name()).param("by", l.createdBy())
                .param("at", ts(l.createdAt())).param("rules", json(mapper, l.rules()))
                .param("scoring", json(mapper, l.scoring())).param("bidder", json(mapper, l.bidder()))
                .update();
    }

    @Override
    public Optional<League> byId(UUID id) {
        return jdbc.sql("SELECT id, name, created_by, created_at, rules, scoring, bidder FROM league WHERE id = :id")
                .param("id", id).query(this::mapLeague).optional();
    }

    @Override
    public void update(League l) {
        jdbc.sql("""
                        UPDATE league SET name = :name, rules = CAST(:rules AS jsonb),
                               scoring = CAST(:scoring AS jsonb), bidder = CAST(:bidder AS jsonb)
                        WHERE id = :id
                        """)
                .param("id", l.id()).param("name", l.name()).param("rules", json(mapper, l.rules()))
                .param("scoring", json(mapper, l.scoring())).param("bidder", json(mapper, l.bidder()))
                .update();
    }

    @Override
    public void insertMember(LeagueMember m) {
        try {
            jdbc.sql("""
                            INSERT INTO league_member (league_id, user_id, role, team_name, initial, joined_at)
                            VALUES (:league, :user, :role, :team, :initial, :at)
                            """)
                    .param("league", m.leagueId()).param("user", m.userId()).param("role", m.role().name())
                    .param("team", m.teamName()).param("initial", String.valueOf(m.initial()))
                    .param("at", ts(m.joinedAt()))
                    .update();
        } catch (DuplicateKeyException e) {
            if (String.valueOf(e.getMessage()).contains("league_member_initial_key")) {
                throw new InitialTakenException(m.initial());
            }
            throw e;
        }
    }

    @Override
    public Optional<LeagueMember> member(UUID leagueId, UUID userId) {
        return jdbc.sql(MEMBER_SELECT + " WHERE m.league_id = :league AND m.user_id = :user")
                .param("league", leagueId).param("user", userId)
                .query(JdbcLeagueRepository::mapMember).optional();
    }

    @Override
    public List<LeagueMember> members(UUID leagueId) {
        return jdbc.sql(MEMBER_SELECT + " WHERE m.league_id = :league ORDER BY m.joined_at, u.display_name")
                .param("league", leagueId).query(JdbcLeagueRepository::mapMember).list();
    }

    @Override
    public List<LeagueMember> membershipsOf(UUID userId) {
        return jdbc.sql(MEMBER_SELECT + " WHERE m.user_id = :user")
                .param("user", userId).query(JdbcLeagueRepository::mapMember).list();
    }

    @Override
    public void deleteMember(UUID leagueId, UUID userId) {
        jdbc.sql("DELETE FROM league_member WHERE league_id = :league AND user_id = :user")
                .param("league", leagueId).param("user", userId).update();
    }

    private League mapLeague(ResultSet rs, int row) throws SQLException {
        return new League(rs.getObject("id", UUID.class), rs.getString("name"),
                rs.getObject("created_by", UUID.class), instant(rs.getTimestamp("created_at")),
                fromJson(mapper, rs.getString("rules"), LeagueRulesSettings.class),
                fromJson(mapper, rs.getString("scoring"), ScoringSettings.class),
                fromJson(mapper, rs.getString("bidder"), AuctionSettings.class));
    }

    private static LeagueMember mapMember(ResultSet rs, int row) throws SQLException {
        return new LeagueMember(rs.getObject("league_id", UUID.class), rs.getObject("user_id", UUID.class),
                MemberRole.valueOf(rs.getString("role")), rs.getString("team_name"),
                rs.getString("initial").charAt(0), instant(rs.getTimestamp("joined_at")),
                rs.getString("display_name"));
    }
}
