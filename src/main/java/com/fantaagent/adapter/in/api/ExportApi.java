package com.fantaagent.adapter.in.api;

import com.fantaagent.adapter.in.security.AppUserPrincipal;
import com.fantaagent.application.service.RosterCsvExporter;
import com.fantaagent.application.service.auction.AuctionView;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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

    private final ApiAccess access;

    public ExportApi(ApiAccess access) {
        this.access = access;
    }

    @GetMapping(value = "/export.csv", produces = "text/csv")
    public ResponseEntity<byte[]> export(@PathVariable String leagueId,
                                         @PathVariable String auctionId,
                                         @AuthenticationPrincipal AppUserPrincipal me) {
        AuctionView view = access.auction(leagueId, auctionId, me);
        byte[] csv = RosterCsvExporter.toCsv(view.service()).getBytes(StandardCharsets.UTF_8);
        String fileName = "rose-" + view.auction().name() + ".csv";
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                // Il costruttore di Spring, non la concatenazione a mano: il nome dell'asta
                // e' quello scelto da chi la crea, con qualunque carattere ci abbia messo —
                // esattamente il caso che questo costruttore copre. Una virgoletta in
                // quel nome romperebbe una stringa quotata scritta a mano; un nome accentato
                // finirebbe scritto senza dichiarare una codifica. Questo costruttore applica
                // RFC 6266/5987 (escaping e parametro esteso filename*) a prescindere da cosa
                // contenga il nome.
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment()
                                .filename(fileName, StandardCharsets.UTF_8)
                                .build().toString())
                .body(csv);
    }
}
