package com.fantaagent.adapter.in.web;

import com.fantaagent.adapter.in.web.dto.ViewModels;
import com.fantaagent.application.port.out.PlayerCatalog;
import com.fantaagent.application.service.AuctionRuntime;
import com.fantaagent.application.service.AuctionService;
import com.fantaagent.application.service.PlayerSearchService;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.AuctionSettingsHolder;
import com.fantaagent.config.AuctionSettingsStore;
import com.fantaagent.config.AuctionSettingsValidator;
import com.fantaagent.domain.player.Player;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;

/**
 * La pagina BATTITORE: quella che si proietta sullo schermo che guardano tutti.
 *
 * <p><b>Il vincolo che governa questo file.</b> Nulla che esca da qui puo' contenere
 * una valutazione: ne' max bid, ne' prezzo atteso, ne' punti attesi, fantamedia,
 * titolarita', margine o verdetto. Non e' una questione di quanto si sceglie di
 * mostrare nel template — e' che i modelli montati qui non hanno un campo dove quei
 * numeri possano stare. {@link ViewModels.PublicBidder} non contiene la
 * raccomandazione, e la ricerca restituisce {@link Player}, che porta solo nome,
 * squadra, ruolo e quotazione del listone: dati che ogni partecipante ha gia' stampati
 * davanti. Nemmeno guardando il sorgente della pagina si trova altro.
 *
 * <p>Per questo il controller non riceve
 * {@link com.fantaagent.application.service.PlayerAnalysisService}: non ha modo di
 * calcolare una raccomandazione neppure volendo, e chi in futuro volesse mostrarne una
 * dovrebbe prima iniettarlo, cioe' compiere un gesto visibile in revisione invece che
 * aggiungere una riga a un template.
 *
 * <p>Cio' che invece si mostra — giocatori acquistati, prezzi pagati, crediti e slot
 * residui — e' pubblico per natura: sono i numeri che in asta ogni partecipante tiene
 * a mano sul proprio foglio.
 */
@Controller
@RequestMapping("/legacy")
public class BattitoreController {

    /** Poche righe: la lista sta su uno schermo condiviso, non e' un catalogo da sfogliare. */
    private static final int SEARCH_ROWS = 8;

    /**
     * Le risposte che cambiano stato aggiornano due regioni in una volta: il tabellone
     * come swap normale e l'indicatore FASE in testa alla pagina come out-of-band. Un
     * avanzamento di fase che lasciasse il badge fermo sul ruolo precedente mostrerebbe
     * a tutta la stanza una fase che non e' quella in corso.
     */
    private static final String BOARD_UPDATE = "fragments/battitore-update :: boardUpdate";

    private final AuctionService auction;
    private final PlayerSearchService search;
    private final PlayerCatalog catalog;
    private final AuctionRuntime runtime;
    private final AuctionSettingsHolder auctionSettings;
    private final AuctionSettingsStore auctionStore;

    public BattitoreController(AuctionService auction, PlayerSearchService search,
                               PlayerCatalog catalog, AuctionRuntime runtime,
                               AuctionSettingsHolder auctionSettings,
                               AuctionSettingsStore auctionStore) {
        this.auction = auction;
        this.search = search;
        this.catalog = catalog;
        this.runtime = runtime;
        this.auctionSettings = auctionSettings;
        this.auctionStore = auctionStore;
    }

    @GetMapping("/battitore")
    public String page(Model model) {
        if (!runtime.hasAuction()) {
            return "redirect:/legacy";
        }
        populate(model, null);
        model.addAttribute("results", List.<Player>of());
        return "battitore";
    }

    /**
     * Cerca nel listone. Restituisce {@link Player} e nient'altro: nome, squadra, ruolo
     * e quotazione, gli stessi quattro dati che stanno sul listone cartaceo.
     */
    @GetMapping("/battitore/cerca")
    public String find(@RequestParam(name = "q", defaultValue = "") String query, Model model) {
        List<Player> results = query.isBlank()
                ? List.of()
                : search.search(query).stream().limit(SEARCH_ROWS).toList();
        model.addAttribute("results", results);
        return "battitore :: results";
    }

    /**
     * Il popup, senza alcuna valutazione: vedi il commento in testa alla classe.
     *
     * @param subito apre gia' in aggiudicazione, saltando il countdown. Serve quando
     *               non c'e' un'asta da battere — il giocatore va a chi lo ha chiamato,
     *               nessuno rilancia — e aspettare lo scadere di un timer che non
     *               misura nulla sarebbe solo tempo perso davanti a tutti.
     */
    @GetMapping("/battitore/popup")
    public String popup(@RequestParam String playerId,
                        @RequestParam(defaultValue = "false") boolean subito, Model model) {
        Optional<Player> player = catalog.byId(playerId);
        if (player.isEmpty()) {
            return "fragments/empty :: empty";
        }
        AuctionSettings settings = auctionSettings.get();
        model.addAttribute("bidder", new ViewModels.PublicBidder(player.get(),
                settings.bidTimerSeconds(), settings.beepEnabled()));
        model.addAttribute("participants", auction.participants());
        model.addAttribute("immediate", subito);
        return "fragments/bidder-public :: bidder";
    }

    /**
     * Registra l'aggiudicazione dalla pagina proiettata.
     *
     * <p>Endpoint distinto da /legacy/assign solo perche' deve rendere una pagina diversa:
     * l'acquisto passa dallo stesso {@link AuctionService#recordPurchase}, con la stessa
     * validazione e gli stessi messaggi di rifiuto. La regola che conta e' che esista
     * una sola via per REGISTRARE un acquisto, non una sola per disegnarlo.
     */
    @PostMapping("/battitore/assegna")
    public String assign(@RequestParam String playerId, @RequestParam String participantId,
                         @RequestParam int price, Model model) {
        String message;
        try {
            auction.recordPurchase(playerId, participantId, price);
            Player player = catalog.byId(playerId).orElseThrow();
            message = "✓ " + player.name() + " → " + nameOf(participantId) + " " + price;
        } catch (IllegalArgumentException e) {
            message = "✗ " + e.getMessage();
        }
        populate(model, message);
        return BOARD_UPDATE;
    }

    /**
     * Scarica le rose nel formato di importazione di Fantacalcio.it.
     *
     * <p>Sta qui e non fra le pagine private perche' e' da qui che si conduce l'asta e
     * qui che si arriva alla fine. Non espone nulla di strategico: contiene gli stessi
     * acquisti gia' proiettati sul tabellone, con i loro prezzi.
     *
     * <p>Il tipo e' text/csv con charset esplicito e Content-Disposition attachment: un
     * charset assente lascerebbe indovinare la codifica al browser, e un nome accentato
     * arriverebbe corrotto dentro il file caricato in lega.
     */
    @GetMapping("/battitore/esporta")
    public ResponseEntity<byte[]> export() {
        if (!runtime.hasAuction()) {
            return ResponseEntity.notFound().build();
        }
        byte[] csv = RosterCsvExporter.toCsv(auction).getBytes(StandardCharsets.UTF_8);
        String fileName = "rose-" + runtime.currentAuctionId() + ".csv";
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + fileName + "\"")
                .body(csv);
    }

    /**
     * Cambia la durata del countdown senza lasciare la pagina.
     *
     * <p>Prima si doveva uscire dalla schermata proiettata, passare dall'asta e poi
     * dalle impostazioni: un giro che a meta' asta non si fa, quindi il timer restava
     * quello sbagliato per tutta la sera. La durata non e' un'informazione strategica —
     * non entra in alcun calcolo — quindi puo' stare su uno schermo condiviso.
     *
     * <p>Il valore si applica al PROSSIMO battitore che si apre: cambiarlo mentre un
     * countdown scorre lo lascerebbe a meta' fra due durate.
     *
     * @param delta scatti da sommare alla durata attuale, positivi o negativi
     */
    @PostMapping("/battitore/timer")
    public String timer(@RequestParam int delta, Model model) {
        AuctionSettings current = auctionSettings.get();
        int wanted = Math.clamp(current.bidTimerSeconds() + delta,
                AuctionSettingsValidator.MIN_SECONDS, AuctionSettingsValidator.MAX_SECONDS);
        AuctionSettings candidate = new AuctionSettings(wanted, current.beepEnabled());

        // La validazione resta l'autorita' anche se il clamp qui sopra la rende gia'
        // soddisfatta: due strade per decidere cosa e' valido divergono, prima o poi.
        if (AuctionSettingsValidator.validate(candidate).isEmpty()) {
            auctionStore.save(candidate);
            auctionSettings.set(candidate);
        }
        model.addAttribute("bidderSettings", auctionSettings.get());
        model.addAttribute("bidderMinSeconds", AuctionSettingsValidator.MIN_SECONDS);
        model.addAttribute("bidderMaxSeconds", AuctionSettingsValidator.MAX_SECONDS);
        return "battitore :: timerControl";
    }

    @PostMapping("/battitore/revoca")
    public String revoke(@RequestParam long targetSeq, Model model) {
        String message;
        try {
            auction.revokePurchase(targetSeq);
            message = "↩ acquisto rimosso";
        } catch (IllegalArgumentException e) {
            message = "✗ " + e.getMessage();
        }
        populate(model, message);
        return BOARD_UPDATE;
    }

    /**
     * Avanza alla fase successiva dalla pagina proiettata.
     *
     * <p>Resta un gesto deliberato e non un automatismo: la fase NON avanza da sola
     * quando l'ultimo slot si chiude. Una revoca e' proprio cio' che accade piu'
     * spesso subito dopo l'ultimo acquisto di un ruolo — ci si accorge di avere
     * sbagliato acquirente o prezzo — e con l'avanzamento automatico ci si
     * ritroverebbe a correggere un ruolo mentre l'applicazione ne mostra un altro.
     *
     * <p>Che la fase sia finita e' comunque informazione pubblica: chiunque in stanza
     * puo' ricavarla contando le rose. Annunciarla sullo schermo non regala nulla.
     */
    @PostMapping("/battitore/fase")
    public String nextPhase(Model model) {
        String message = auction.advancePhase()
                ? "fase avanzata a " + auction.state().currentPhase()
                : "già all'ultima fase";
        populate(model, message);
        return BOARD_UPDATE;
    }

    private String nameOf(String participantId) {
        return auction.participants().stream()
                .filter(p -> p.id().equals(participantId))
                .findFirst()
                .map(com.fantaagent.domain.league.Participant::name)
                .orElse(participantId);
    }

    private void populate(Model model, String message) {
        model.addAttribute("columns", RecapView.columns(auction));
        model.addAttribute("roles", RecapView.ROLE_ORDER);
        model.addAttribute("participants", auction.participants());
        model.addAttribute("phase", auction.state().currentPhase());
        model.addAttribute("phaseDone", PhaseCompletion.of(auction.state()));
        model.addAttribute("bidderSettings", auctionSettings.get());
        model.addAttribute("bidderMinSeconds", AuctionSettingsValidator.MIN_SECONDS);
        model.addAttribute("bidderMaxSeconds", AuctionSettingsValidator.MAX_SECONDS);
        model.addAttribute("message", message);
    }
}
