package com.fantaagent.adapter.out.jdbc;

import com.fantaagent.application.port.out.JoinRequest;
import com.fantaagent.application.port.out.JoinRequestRepository;
import com.fantaagent.application.port.out.LeagueMatch;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static com.fantaagent.adapter.out.jdbc.Columns.instant;
import static com.fantaagent.adapter.out.jdbc.Columns.ts;

public class JdbcJoinRequestRepository implements JoinRequestRepository {

    // Una richiesta di chi e' gia' membro — entrato col link mentre aspettava — non
    // e' piu' aperta: la si esclude qui invece di doverla cancellare a ogni ingresso.
    private static final String SELECT = """
            SELECT r.league_id, r.user_id, r.team_name, r.requested_at, u.display_name, l.name AS league_name
            FROM league_join_request r
            JOIN app_user u ON u.id = r.user_id
            JOIN league l ON l.id = r.league_id
            WHERE NOT EXISTS (SELECT 1 FROM league_member m
                              WHERE m.league_id = r.league_id AND m.user_id = r.user_id)
            """;

    private final JdbcClient jdbc;

    public JdbcJoinRequestRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void upsert(JoinRequest r) {
        jdbc.sql("""
                        INSERT INTO league_join_request (league_id, user_id, team_name, requested_at)
                        VALUES (:league, :user, :team, :at)
                        ON CONFLICT (league_id, user_id)
                        DO UPDATE SET team_name = EXCLUDED.team_name, requested_at = EXCLUDED.requested_at
                        """)
                .param("league", r.leagueId()).param("user", r.userId()).param("team", r.teamName())
                .param("at", ts(r.requestedAt()))
                .update();
    }

    @Override
    public Optional<JoinRequest> find(UUID leagueId, UUID userId) {
        return jdbc.sql(SELECT + " AND r.league_id = :league AND r.user_id = :user")
                .param("league", leagueId).param("user", userId)
                .query(JdbcJoinRequestRepository::map).optional();
    }

    @Override
    public List<JoinRequest> byLeague(UUID leagueId) {
        return jdbc.sql(SELECT + " AND r.league_id = :league ORDER BY r.requested_at")
                .param("league", leagueId).query(JdbcJoinRequestRepository::map).list();
    }

    @Override
    public List<JoinRequest> byUser(UUID userId) {
        return jdbc.sql(SELECT + " AND r.user_id = :user ORDER BY r.requested_at DESC")
                .param("user", userId).query(JdbcJoinRequestRepository::map).list();
    }

    @Override
    public Map<UUID, Integer> countByLeague(Collection<UUID> leagueIds) {
        Map<UUID, Integer> counts = new HashMap<>();
        if (leagueIds.isEmpty()) {
            return counts;
        }
        jdbc.sql("""
                        SELECT r.league_id, count(*) AS n FROM league_join_request r
                        WHERE r.league_id IN (:leagues)
                          AND NOT EXISTS (SELECT 1 FROM league_member m
                                          WHERE m.league_id = r.league_id AND m.user_id = r.user_id)
                        GROUP BY r.league_id
                        """)
                .param("leagues", leagueIds)
                .query((rs, row) -> counts.put(rs.getObject("league_id", UUID.class), rs.getInt("n")))
                .list();
        return counts;
    }

    @Override
    public boolean delete(UUID leagueId, UUID userId) {
        return jdbc.sql("DELETE FROM league_join_request WHERE league_id = :league AND user_id = :user")
                .param("league", leagueId).param("user", userId).update() == 1;
    }

    /**
     * {@code position} e non {@code LIKE}: un «%» o un «_» nel testo cercato sono
     * lettere come le altre, senza doverli sfuggire. Nessun indice aiuta una ricerca
     * «contiene»: si scorre la tabella delle leghe, che resta piccola rispetto a
     * quella degli eventi. Con molte leghe servira' pg_trgm.
     */
    @Override
    public List<LeagueMatch> search(String text, UUID viewer, int limit) {
        return jdbc.sql("""
                        SELECT l.id, l.name,
                               (SELECT u.display_name FROM league_member a JOIN app_user u ON u.id = a.user_id
                                WHERE a.league_id = l.id AND a.role = 'ADMIN'
                                ORDER BY a.joined_at LIMIT 1) AS admin_name,
                               (SELECT count(*) FROM league_member m WHERE m.league_id = l.id) AS members,
                               EXISTS (SELECT 1 FROM league_member m
                                       WHERE m.league_id = l.id AND m.user_id = :viewer) AS member,
                               EXISTS (SELECT 1 FROM league_join_request r
                                       WHERE r.league_id = l.id AND r.user_id = :viewer) AS pending
                        FROM league l
                        WHERE position(lower(:text) IN lower(l.name)) > 0
                        ORDER BY position(lower(:text) IN lower(l.name)) <> 1, lower(l.name), l.created_at
                        LIMIT :limit
                        """)
                .param("text", text).param("viewer", viewer).param("limit", limit)
                .query((rs, row) -> new LeagueMatch(rs.getObject("id", UUID.class), rs.getString("name"),
                        rs.getString("admin_name") == null ? "" : rs.getString("admin_name"),
                        rs.getInt("members"), rs.getBoolean("member"),
                        !rs.getBoolean("member") && rs.getBoolean("pending")))
                .list();
    }

    private static JoinRequest map(ResultSet rs, int row) throws SQLException {
        return new JoinRequest(rs.getObject("league_id", UUID.class), rs.getObject("user_id", UUID.class),
                rs.getString("team_name"), instant(rs.getTimestamp("requested_at")),
                rs.getString("display_name"), rs.getString("league_name"));
    }
}
