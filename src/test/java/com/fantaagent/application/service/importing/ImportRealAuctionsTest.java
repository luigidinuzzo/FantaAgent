package com.fantaagent.application.service.importing;

import com.fantaagent.application.port.out.LeagueMember;
import com.fantaagent.application.port.out.LeagueRepository;
import com.fantaagent.application.port.out.MemberRole;
import com.fantaagent.application.service.auction.LeagueAuctionService;
import com.fantaagent.application.service.auction.LogSummary;
import com.fantaagent.application.service.league.LeagueAccess;
import com.fantaagent.application.service.league.LeagueService;
import com.fantaagent.testsupport.OldAuctionFiles;
import com.fantaagent.testsupport.TestRows;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Le aste vere, quelle giocate: ognuna deve entrare e rileggersi uguale. Legge
 * {@code res/auctions} senza toccarlo; i file finiscono in memoria, non su disco.
 */
@SpringBootTest
@ActiveProfiles("dev")
class ImportRealAuctionsTest {

    @Autowired
    AuctionImportService imports;
    @Autowired
    LeagueService leagues;
    @Autowired
    LeagueAuctionService auctions;
    @Autowired
    LeagueRepository leagueRepository;
    @Autowired
    JdbcClient jdbc;

    @Test
    void ogniAstaGiocataSiImportaUguale() throws IOException {
        Assumptions.assumeTrue(Files.isDirectory(Path.of("res/auctions")),
                "res/auctions non c'e' in questo clone: si salta.");

        List<Path> dirs;
        try (Stream<Path> s = Files.list(Path.of("res/auctions"))) {
            dirs = s.filter(d -> Files.exists(d.resolve("events.jsonl"))).sorted().toList();
        }
        assertThat(dirs).isNotEmpty();

        for (Path dir : dirs) {
            Map<String, byte[]> files = OldAuctionFiles.read(dir);
            UUID adminId = TestRows.user(jdbc, "admin+" + UUID.randomUUID() + "@example.com");
            LeagueAccess admin = leagues.create(adminId, "Lega " + dir.getFileName(), "Admin FC", "Z");
            ImportPreview preview = imports.preview(admin, files);

            Map<String, UUID> mapping = new HashMap<>();
            char initial = 'A';
            for (ImportPreview.FileParticipant p : preview.participants()) {
                UUID member = TestRows.user(jdbc, "m+" + UUID.randomUUID() + "@example.com");
                leagueRepository.insertMember(new LeagueMember(admin.leagueId(), member, MemberRole.MEMBER,
                        p.name(), initial++, Instant.now(), null));
                mapping.put(p.id(), member);
            }

            UUID id = imports.importAuction(admin, files, mapping);

            assertThat(auctions.list(admin)).filteredOn(c -> c.id().equals(id)).singleElement()
                    .satisfies(c -> assertThat(c.purchases()).as(dir.toString()).isEqualTo(preview.purchases()));
        }
    }
}
