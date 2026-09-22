package com.fantaagent.adapter.in.api;

import com.fantaagent.adapter.in.api.dto.AuctionsDtos;
import com.fantaagent.application.service.AuctionRuntime;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * L'elenco delle aste, e il passaggio dall'una all'altra.
 *
 * <p><b>{@link AuctionGuard} non si applica a questi endpoint, ed e' deliberato.</b>
 * Quella guardia accetta solo l'asta aperta e il letterale {@code corrente};
 * {@code select} riceve per definizione l'id di un'asta DIVERSA da quella aperta.
 * Applicarla renderebbe impossibile cambiare asta, e il difetto si scoprirebbe solo
 * dal vivo. La validita' dell'id la verifica {@link AuctionRuntime#select}, che
 * conosce l'archivio.
 */
@RestController
@RequestMapping("/api/leagues/{leagueId}/auctions")
public class AuctionsApi {

    private final LeagueGuard leagues;
    private final AuctionRuntime runtime;

    public AuctionsApi(LeagueGuard leagues, AuctionRuntime runtime) {
        this.leagues = leagues;
        this.runtime = runtime;
    }

    @GetMapping
    public List<AuctionsDtos.AuctionCard> list(@PathVariable String leagueId) {
        leagues.check(leagueId);
        return runtime.auctions().stream().map(AuctionsDtos.AuctionCard::from).toList();
    }

    @PostMapping("/{auctionId}/select")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void select(@PathVariable String leagueId, @PathVariable String auctionId) {
        leagues.check(leagueId);
        try {
            runtime.select(auctionId);
        } catch (IllegalArgumentException e) {
            // Non solo "id assente dall'archivio": select ricostruisce anche la catena
            // di valutazione, che puo' rifiutare un guasto di configurazione vero con
            // la stessa eccezione. Scartare la causa renderebbe i due casi
            // indistinguibili nei log — la si incatena qui.
            throw new UnknownAuctionException(auctionId, e);
        }
    }

    /**
     * Toglie un'asta dall'elenco spostandone la cartella nel cestino. Non passa da
     * AuctionGuard per lo stesso motivo di select: l'asta da cancellare e' spesso una
     * diversa da quella aperta.
     */
    @DeleteMapping("/{auctionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String leagueId, @PathVariable String auctionId) {
        leagues.check(leagueId);
        try {
            runtime.delete(auctionId);
        } catch (IllegalArgumentException e) {
            throw new UnknownAuctionException(auctionId, e);
        }
    }

    /**
     * Rinomina un'asta, anche diversa da quella aperta: per questo niente
     * AuctionGuard, come select e delete. Il nome segue le regole della creazione.
     */
    @PatchMapping("/{auctionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void rename(@PathVariable String leagueId, @PathVariable String auctionId,
                       @RequestBody AuctionsDtos.RenameRequest body) {
        leagues.check(leagueId);
        String name = body.name() == null ? "" : body.name().trim();
        if (name.isEmpty()) {
            throw new InvalidSettingsException(Map.of("auctionName",
                    List.of("Dai un nome all'asta: serve a riconoscerla nell'elenco.")));
        }
        if (name.length() > SettingsApi.MAX_NAME) {
            throw new InvalidSettingsException(Map.of("auctionName",
                    List.of("Il nome dell'asta non puo' superare " + SettingsApi.MAX_NAME
                            + " caratteri.")));
        }
        try {
            runtime.rename(auctionId, name);
        } catch (IllegalArgumentException e) {
            throw new UnknownAuctionException(auctionId, e);
        }
    }

    /**
     * Copia partecipanti, regole, punteggio e battitore di un'asta in una nuova, senza
     * acquisti e senza aprirla. Il nome e' quello di partenza con «(copia)», tagliato
     * al limite dei nomi: si cambia poi con la rinomina.
     */
    @PostMapping("/{auctionId}/duplicate")
    @ResponseStatus(HttpStatus.CREATED)
    public AuctionsDtos.DuplicateResponse duplicate(@PathVariable String leagueId,
                                                    @PathVariable String auctionId) {
        leagues.check(leagueId);
        try {
            String suffix = " (copia)";
            String base = runtime.labelOf(auctionId);
            int room = SettingsApi.MAX_NAME - suffix.length();
            String name = (base.length() > room ? base.substring(0, room).trim() : base) + suffix;
            return new AuctionsDtos.DuplicateResponse(runtime.duplicate(auctionId, name));
        } catch (IllegalArgumentException e) {
            throw new UnknownAuctionException(auctionId, e);
        }
    }

    @PostMapping("/current/leave")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void leave(@PathVariable String leagueId) {
        leagues.check(leagueId);
        // Chiude davvero invece di limitarsi a cambiare schermata: la preparazione di
        // una nuova asta distingue le sue due modalita' proprio da questo, e uscire
        // lasciando l'asta aperta riporterebbe al caso in cui "nuova asta" mostrava le
        // impostazioni di quella in corso. Non si perde nulla: il registro e' su disco.
        runtime.deselect();
    }
}
