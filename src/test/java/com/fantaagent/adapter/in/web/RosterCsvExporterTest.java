package com.fantaagent.adapter.in.web;

import com.fantaagent.application.service.AuctionService;
import com.fantaagent.domain.auction.AuctionEvent;
import com.fantaagent.domain.auction.AuctionProjector;
import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Role;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Il formato non e' un'opinione: e' ricalcato su res/template_export.csv, un export
 * reale di Fantacalcio.it. Questi test bloccano i dettagli che, sbagliati, fanno
 * fallire l'import senza un messaggio utile.
 */
class RosterCsvExporterTest {

    private static final LeagueRules RULES = new LeagueRules(2, 100,
            Map.of(Role.P, 1, Role.D, 1, Role.C, 1, Role.A, 1),
            List.of(Role.P, Role.D, Role.C, Role.A));

    private static AuctionService serviceWith(List<Participant> participants,
                                              Map<String, Role> roles,
                                              List<AuctionEvent> events) {
        AuctionService auction = Mockito.mock(AuctionService.class);
        AuctionState state = AuctionProjector.project(RULES, participants,
                id -> roles.getOrDefault(id, Role.D), events);
        Mockito.when(auction.participants()).thenReturn(participants);
        Mockito.when(auction.state()).thenReturn(state);
        return auction;
    }

    private static AuctionEvent buy(long seq, String playerId, String who, int price) {
        return new AuctionEvent.PlayerPurchased(seq, Instant.EPOCH, playerId, who, price);
    }

    @Test
    void ogniBloccoIniziaConIlSeparatoreEcontieneNomeIdPrezzo() {
        AuctionService auction = serviceWith(
                List.of(new Participant("me", "Anna", 'L', true),
                        new Participant("p2", "Bruno", 'S', false)),
                Map.of("101", Role.P, "202", Role.A),
                List.of(buy(1, "101", "me", 18), buy(2, "202", "p2", 76)));

        assertThat(RosterCsvExporter.toCsv(auction)).isEqualTo(
                "$,$,$\nAnna,101,18\n$,$,$\nBruno,202,76");
    }

    /**
     * Nessun BOM, LF e non CRLF, nessuna newline finale: sono i tre dettagli del
     * template. Una newline finale produce, in un parser ingenuo, un ultimo record
     * vuoto — una fantasquadra senza nome con un giocatore senza id.
     */
    @Test
    void rispettaIdettagliDiByteDelTemplate() {
        AuctionService auction = serviceWith(
                List.of(new Participant("me", "Anna", 'L', true),
                        new Participant("p2", "Bruno", 'S', false)),
                Map.of("101", Role.P),
                List.of(buy(1, "101", "me", 18)));

        String csv = RosterCsvExporter.toCsv(auction);

        assertThat(csv).doesNotStartWith("﻿");
        assertThat(csv).doesNotContain("\r");
        assertThat(csv).doesNotEndWith("\n");
    }

    /** Raggruppati per P, D, C, A: cosi' il file si controlla a colpo d'occhio. */
    @Test
    void raggruppaPerRuoloNellOrdineDelleFasi() {
        AuctionService auction = serviceWith(
                List.of(new Participant("me", "Anna", 'L', true),
                        new Participant("p2", "Bruno", 'S', false)),
                Map.of("att", Role.A, "por", Role.P, "cen", Role.C, "dif", Role.D),
                List.of(buy(1, "att", "me", 80), buy(2, "cen", "me", 40),
                        buy(3, "por", "me", 10), buy(4, "dif", "me", 20)));

        assertThat(RosterCsvExporter.toCsv(auction).lines().toList())
                .containsSubsequence("Anna,por,10", "Anna,dif,20",
                        "Anna,cen,40", "Anna,att,80");
    }

    /** A pari ruolo, prezzo decrescente e id come spareggio: ordine riproducibile. */
    @Test
    void aPariRuoloOrdinaPerPrezzoDecrescenteInModoRiproducibile() {
        AuctionService auction = serviceWith(
                List.of(new Participant("me", "Anna", 'L', true),
                        new Participant("p2", "Bruno", 'S', false)),
                Map.of("a", Role.D, "b", Role.D, "c", Role.D),
                List.of(buy(1, "b", "me", 5), buy(2, "a", "me", 5), buy(3, "c", "me", 30)));

        assertThat(RosterCsvExporter.toCsv(auction).lines().toList())
                .containsSubsequence("Anna,c,30", "Anna,a,5", "Anna,b,5");
    }

    /**
     * Una virgola in un nome spezzerebbe la riga in quattro campi e l'import
     * assegnerebbe i giocatori a una squadra che non esiste.
     */
    @Test
    void proteggeUnNomeCheContieneUnaVirgola() {
        AuctionService auction = serviceWith(
                List.of(new Participant("me", "Rossi, Anna", 'R', true),
                        new Participant("p2", "Bruno", 'S', false)),
                Map.of("101", Role.P),
                List.of(buy(1, "101", "me", 18)));

        assertThat(RosterCsvExporter.toCsv(auction)).contains("\"Rossi, Anna\",101,18");
    }

    /** Una e commerciale non e' un carattere speciale in CSV: niente virgolette. */
    @Test
    void nonQuotaInutilmenteUnNomeConLaEcommerciale() {
        AuctionService auction = serviceWith(
                List.of(new Participant("me", "Rossi&Bianchi", 'G', true),
                        new Participant("p2", "Bruno", 'S', false)),
                Map.of("101", Role.P),
                List.of(buy(1, "101", "me", 18)));

        assertThat(RosterCsvExporter.toCsv(auction)).contains("Rossi&Bianchi,101,18");
    }

    /** Un partecipante senza acquisti resta nel file, col solo separatore. */
    @Test
    void unPartecipanteSenzaAcquistiCompareComunque() {
        AuctionService auction = serviceWith(
                List.of(new Participant("me", "Anna", 'L', true),
                        new Participant("p2", "Bruno", 'S', false)),
                Map.of(), List.of());

        assertThat(RosterCsvExporter.toCsv(auction)).isEqualTo("$,$,$\n$,$,$");
    }
}
