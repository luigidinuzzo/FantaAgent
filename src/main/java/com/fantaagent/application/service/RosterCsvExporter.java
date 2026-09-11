package com.fantaagent.application.service;

import com.fantaagent.domain.auction.Holding;
import com.fantaagent.domain.auction.Squad;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Role;

import java.util.Comparator;
import java.util.List;

/**
 * Le rose dell'asta nel formato di importazione di Fantacalcio.it.
 *
 * <p>Il formato non e' stato dedotto: e' ricalcato su res/template_export.csv, un
 * export reale della piattaforma. Tre righe di intestazione non esistono; un blocco per
 * fantasquadra e' introdotto da una riga separatrice {@code $,$,$}; ogni riga successiva
 * e' {@code nome,idGiocatore,prezzo}.
 *
 * <p><b>Dettagli di byte che decidono se l'import riesce.</b> Il template non ha BOM,
 * usa LF e non CRLF, e non termina con una newline. Sono riprodotti alla lettera: una
 * newline finale produce, in un parser ingenuo, un ultimo record vuoto — cioe' una
 * fantasquadra senza nome con un giocatore senza id — e un import che fallisce senza
 * dire dove.
 *
 * <p><b>L'ordine delle righe.</b> Nel template i ruoli sono sparsi (il primo blocco
 * comincia con tre attaccanti), il che dimostra che la piattaforma ricava il ruolo
 * dall'id del giocatore e non dalla posizione della riga. Potendo scegliere, qui si
 * raggruppa per P, D, C, A: un file in cui si contano a colpo d'occhio 3 portieri, 8
 * difensori, 8 centrocampisti e 6 attaccanti e' un file che si puo' controllare prima
 * di caricarlo, e questo caricamento non si annulla.
 */
public final class RosterCsvExporter {

    /** Separatore di blocco, letterale come nel template. */
    private static final String BLOCK_SEPARATOR = "$,$,$";

    private static final List<Role> ROLE_ORDER = List.of(Role.P, Role.D, Role.C, Role.A);

    private RosterCsvExporter() {
    }

    public static String toCsv(AuctionService auction) {
        StringBuilder sb = new StringBuilder();
        for (Participant participant : auction.participants()) {
            Squad squad = auction.state().squadOf(participant.id());
            if (!sb.isEmpty()) {
                sb.append('\n');
            }
            sb.append(BLOCK_SEPARATOR);
            for (Holding holding : ordered(squad)) {
                sb.append('\n')
                  .append(field(participant.name())).append(',')
                  .append(holding.playerId()).append(',')
                  .append(holding.price());
            }
        }
        return sb.toString();
    }

    /** Per ruolo, poi prezzo decrescente, poi id: un ordine totale e riproducibile. */
    private static List<Holding> ordered(Squad squad) {
        return squad.holdings().stream()
                .sorted(Comparator.comparingInt((Holding h) -> ROLE_ORDER.indexOf(h.role()))
                        .thenComparing(Comparator.comparingInt(Holding::price).reversed())
                        .thenComparing(Holding::playerId))
                .toList();
    }

    /**
     * Quoting RFC 4180, che serve solo se qualcuno rinomina un partecipante con una
     * virgola dentro. Senza, quella virgola spezzerebbe la riga in quattro campi e
     * l'import assegnerebbe i giocatori a una squadra inesistente.
     */
    private static String field(String value) {
        if (value.indexOf(',') < 0 && value.indexOf('"') < 0 && value.indexOf('\n') < 0) {
            return value;
        }
        return '"' + value.replace("\"", "\"\"") + '"';
    }
}
