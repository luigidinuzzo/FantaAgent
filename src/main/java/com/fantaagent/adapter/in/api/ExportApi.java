package com.fantaagent.adapter.in.api;

import com.fantaagent.application.service.AuctionService;
import com.fantaagent.application.service.RosterCsvExporter;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;

/**
 * Esporta le rose dell'asta nel formato di importazione di Fantacalcio.it, per la SPA.
 *
 * <p>L'esportatore e' lo stesso che serviva la pagina BATTITORE: si e' spostato in
 * {@code application.service} proprio perche' questo controller potesse chiamarlo senza
 * duplicarne il formato.
 *
 * <p>Il tipo e' text/csv con charset esplicito: i nomi dei giocatori portano accenti, e
 * un charset non dichiarato lascia indovinare la codifica a chi apre il file, con esiti
 * diversi da programma a programma.
 */
@RestController
@RequestMapping("/api/leagues/{leagueId}/auctions/{auctionId}")
public class ExportApi {

    private final LeagueGuard leagues;
    private final AuctionGuard auctions;
    private final AuctionService auction;

    public ExportApi(LeagueGuard leagues, AuctionGuard auctions, AuctionService auction) {
        this.leagues = leagues;
        this.auctions = auctions;
        this.auction = auction;
    }

    @GetMapping(value = "/export.csv", produces = "text/csv")
    public ResponseEntity<byte[]> export(@PathVariable String leagueId,
                                         @PathVariable String auctionId) {
        leagues.check(leagueId);
        auctions.check(auctionId);
        byte[] csv = RosterCsvExporter.toCsv(auction).getBytes(StandardCharsets.UTF_8);
        String fileName = "rose-" + auction.auctionId() + ".csv";
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + fileName + "\"")
                .body(csv);
    }
}
