package com.fantaagent.adapter.out.jdbc;

import com.fantaagent.application.port.out.AuctionRecord;
import com.fantaagent.application.port.out.AuctionRepository;
import com.fantaagent.application.port.out.Seat;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.config.ScoringSettings;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static com.fantaagent.adapter.out.jdbc.Columns.fromJson;
import static com.fantaagent.adapter.out.jdbc.Columns.instant;
import static com.fantaagent.adapter.out.jdbc.Columns.json;
import static com.fantaagent.adapter.out.jdbc.Columns.ts;

public class JdbcAuctionRepository implements AuctionRepository {

    private static final String COLUMNS =
            "id, league_id, name, created_by, created_at, deleted_at, rules, scoring, bidder";

    private final JdbcClient jdbc;
    private final ObjectMapper mapper;

    public JdbcAuctionRepository(JdbcClient jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    @Override
    public void insert(AuctionRecord a, List<Seat> seats) {
        jdbc.sql("""
                        INSERT INTO auction (id, league_id, name, created_by, created_at, deleted_at,
                                             rules, scoring, bidder)
                        VALUES (:id, :league, :name, :by, :at, :deleted, CAST(:rules AS jsonb),
                                CAST(:scoring AS jsonb), CAST(:bidder AS jsonb))
                        """)
                .param("id", a.id()).param("league", a.leagueId()).param("name", a.name())
                .param("by", a.createdBy()).param("at", ts(a.createdAt())).param("deleted", ts(a.deletedAt()))
                .param("rules", json(mapper, a.rules())).param("scoring", json(mapper, a.scoring()))
                .param("bidder", json(mapper, a.bidder()))
                .update();
        insertSeats(a.id(), seats);
    }

    @Override
    public Optional<AuctionRecord> byId(UUID id) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM auction WHERE id = :id")
                .param("id", id).query(this::map).optional();
    }

    @Override
    public List<AuctionRecord> byLeague(UUID leagueId) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM auction WHERE league_id = :league AND deleted_at IS NULL"
                        + " ORDER BY created_at DESC")
                .param("league", leagueId).query(this::map).list();
    }

    @Override
    public void rename(UUID id, String name) {
        jdbc.sql("UPDATE auction SET name = :name WHERE id = :id").param("name", name).param("id", id).update();
    }

    @Override
    public void updateBidder(UUID id, AuctionSettings bidder) {
        jdbc.sql("UPDATE auction SET bidder = CAST(:bidder AS jsonb) WHERE id = :id")
                .param("bidder", json(mapper, bidder)).param("id", id).update();
    }

    @Override
    public void softDelete(UUID id, Instant at) {
        jdbc.sql("UPDATE auction SET deleted_at = :at WHERE id = :id AND deleted_at IS NULL")
                .param("at", ts(at)).param("id", id).update();
    }

    @Override
    public List<Seat> seats(UUID auctionId) {
        return jdbc.sql("SELECT user_id, team_name, initial, position FROM auction_seat"
                        + " WHERE auction_id = :a ORDER BY position")
                .param("a", auctionId)
                .query((rs, row) -> new Seat(rs.getObject("user_id", UUID.class), rs.getString("team_name"),
                        rs.getString("initial").charAt(0), rs.getInt("position")))
                .list();
    }

    /** Nella transazione di chi chiama: il vincolo sulla posizione e' differito apposta. */
    @Override
    public void replaceSeats(UUID auctionId, List<Seat> seats) {
        jdbc.sql("DELETE FROM auction_seat WHERE auction_id = :a").param("a", auctionId).update();
        insertSeats(auctionId, seats);
    }

    @Override
    public void removeSeat(UUID auctionId, UUID userId) {
        jdbc.sql("DELETE FROM auction_seat WHERE auction_id = :a AND user_id = :u")
                .param("a", auctionId).param("u", userId).update();
    }

    @Override
    public List<UUID> auctionsWithSeat(UUID leagueId, UUID userId) {
        return jdbc.sql("""
                        SELECT s.auction_id FROM auction_seat s JOIN auction a ON a.id = s.auction_id
                        WHERE a.league_id = :league AND s.user_id = :user AND a.deleted_at IS NULL
                        ORDER BY s.auction_id
                        """)
                .param("league", leagueId).param("user", userId).query(UUID.class).list();
    }

    @Override
    public void lockForWrite(UUID auctionId) {
        jdbc.sql("SELECT id FROM auction WHERE id = :id FOR UPDATE").param("id", auctionId).query(UUID.class).list();
    }

    private void insertSeats(UUID auctionId, List<Seat> seats) {
        for (Seat s : seats) {
            jdbc.sql("INSERT INTO auction_seat (auction_id, user_id, team_name, initial, position)"
                            + " VALUES (:a, :u, :team, :initial, :pos)")
                    .param("a", auctionId).param("u", s.userId()).param("team", s.teamName())
                    .param("initial", String.valueOf(s.initial())).param("pos", s.position())
                    .update();
        }
    }

    private AuctionRecord map(ResultSet rs, int row) throws SQLException {
        return new AuctionRecord(rs.getObject("id", UUID.class), rs.getObject("league_id", UUID.class),
                rs.getString("name"), rs.getObject("created_by", UUID.class),
                instant(rs.getTimestamp("created_at")), instant(rs.getTimestamp("deleted_at")),
                fromJson(mapper, rs.getString("rules"), LeagueRulesSettings.class),
                fromJson(mapper, rs.getString("scoring"), ScoringSettings.class),
                fromJson(mapper, rs.getString("bidder"), AuctionSettings.class));
    }
}
