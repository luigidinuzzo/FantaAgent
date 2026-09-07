package com.fantaagent.adapter.in.web;

import com.fantaagent.adapter.in.web.dto.ViewModels;
import com.fantaagent.application.service.AuctionService;
import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.auction.Squad;
import com.fantaagent.domain.league.Participant;
import com.fantaagent.domain.player.Role;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Costruisce le colonne del riepilogo: un partecipante ciascuna, i suoi giocatori
 * raggruppati per ruolo col prezzo pagato.
 *
 * <p>Estratto qui perche' due pagine lo mostrano — il riepilogo privato e la pagina
 * BATTITORE proiettata sullo schermo condiviso — e due costruzioni separate
 * divergerebbero: basterebbe correggere un ordinamento o un totale in una sola per
 * avere due tabelle che, dello stesso registro, raccontano cose diverse.
 *
 * <p>Cio' che esce di qui e' pubblico per costruzione: nomi, prezzi pagati, crediti e
 * slot residui. Sono i numeri che ogni partecipante puo' ricavare da se' tenendo il
 * conto degli acquisti, e infatti in asta li tiene. Nessuna valutazione, nessun max
 * bid, nessun punto atteso passa da qui.
 */
final class RecapView {

    static final List<Role> ROLE_ORDER = List.of(Role.P, Role.D, Role.C, Role.A);

    private RecapView() {
    }

    /**
     * L'elenco portato al numero di caselle previsto dal regolamento, aggiungendo
     * caselle vuote in coda.
     *
     * <p>E' cio' che tiene INCOLONNATE le squadre: la riga n e' lo stesso slot per
     * tutti, quindi lo stato di avanzamento di ciascuno si vede guardando invece di
     * contare. Un elenco piu' lungo degli slot non viene troncato — non dovrebbe
     * accadere, perche' recordPurchase rifiuta un acquisto senza slot liberi, ma
     * nascondere un giocatore davvero posseduto sarebbe peggio di una riga in piu'.
     */
    private static List<ViewModels.RecapPlayer> padded(List<ViewModels.RecapPlayer> owned,
                                                       int slots) {
        if (owned.size() >= slots) {
            return owned;
        }
        List<ViewModels.RecapPlayer> full = new ArrayList<>(owned);
        while (full.size() < slots) {
            full.add(ViewModels.RecapPlayer.empty());
        }
        return List.copyOf(full);
    }

    static List<ViewModels.RecapColumn> columns(AuctionService auction) {
        AuctionState state = auction.state();
        List<ViewModels.RecapColumn> columns = new ArrayList<>();
        for (Participant participant : auction.participants()) {
            Squad squad = state.squadOf(participant.id());

            Map<Role, List<ViewModels.RecapPlayer>> byRole = new EnumMap<>(Role.class);
            for (Role role : ROLE_ORDER) {
                List<ViewModels.RecapPlayer> owned = squad.holdings().stream()
                        .filter(h -> h.role() == role)
                        .map(h -> new ViewModels.RecapPlayer(
                                h.seq(), auction.playerName(h), h.price()))
                        .toList();
                byRole.put(role, padded(owned, state.rules().slots(role)));
            }

            columns.add(new ViewModels.RecapColumn(participant.id(), participant.name(),
                    participant.me(), squad.budgetRemaining(), squad.slotsRemaining(), byRole));
        }
        return columns;
    }
}
