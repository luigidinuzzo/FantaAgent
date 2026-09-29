package com.fantaagent.adapter.in.api.importing;

import com.fantaagent.adapter.in.api.ApiAccess;
import com.fantaagent.adapter.in.security.AppUserPrincipal;
import com.fantaagent.application.service.importing.AuctionImportService;
import com.fantaagent.application.service.importing.ImportPreview;
import com.fantaagent.application.service.importing.InvalidImportException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/leagues/{leagueId}/imports")
public class ImportApi {

    public record ImportResult(String auctionId) {
    }

    private final ApiAccess access;
    private final AuctionImportService imports;
    private final ObjectMapper json;

    public ImportApi(ApiAccess access, AuctionImportService imports, ObjectMapper json) {
        this.access = access;
        this.imports = imports;
        this.json = json;
    }

    @PostMapping(value = "/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ImportPreview preview(@AuthenticationPrincipal AppUserPrincipal me, @PathVariable String leagueId,
                                 @RequestPart("files") List<MultipartFile> files) {
        return imports.preview(access.league(leagueId, me), contents(files));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ImportResult importAuction(@AuthenticationPrincipal AppUserPrincipal me, @PathVariable String leagueId,
                                      @RequestPart("files") List<MultipartFile> files,
                                      @RequestPart("mapping") String mapping) {
        UUID id = imports.importAuction(access.league(leagueId, me), contents(files), parse(mapping));
        return new ImportResult(id.toString());
    }

    /**
     * Il nome senza cartella: il browser puo' mandare "asta/events.jsonl". Due file
     * con lo stesso nome (due cartelle scelte insieme, per esempio) si scriverebbero
     * uno sull'altro senza dirlo: meglio rifiutarli subito.
     */
    private static Map<String, byte[]> contents(List<MultipartFile> files) {
        Map<String, byte[]> out = new LinkedHashMap<>();
        for (MultipartFile f : files) {
            String name = f.getOriginalFilename() == null ? "" : f.getOriginalFilename();
            String base = name.substring(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1);
            if (out.containsKey(base)) {
                throw new InvalidImportException(Map.of("files", List.of(
                        "Hai scelto due volte lo stesso documento: scegli la cartella di una sola asta.")));
            }
            try {
                out.put(base, f.getBytes());
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        }
        return out;
    }

    private Map<String, UUID> parse(String mapping) {
        try {
            Map<String, String> raw = json.readValue(mapping, new TypeReference<>() {
            });
            Map<String, UUID> out = new LinkedHashMap<>();
            for (Map.Entry<String, String> e : raw.entrySet()) {
                if (e.getValue() == null) {
                    throw new IllegalArgumentException("valore mancante per " + e.getKey());
                }
                out.put(e.getKey(), UUID.fromString(e.getValue()));
            }
            return out;
        } catch (IOException | IllegalArgumentException e) {
            throw new InvalidImportException(Map.of("mapping", List.of("Abbina ogni partecipante a un membro della lega.")));
        }
    }
}
