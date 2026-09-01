package com.fantaagent.adapter.in.web.dto;

import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.strategy.PriceRecommendation;

import java.util.List;
import java.util.Map;

public final class ViewModels {

    private ViewModels() {
    }

    public record BoardRow(String name, char initial, int budget, String composition,
                           int slotsLeft, boolean me) {
    }

    public record StatusBar(String phase, int soldInPhase, int myBudget,
                            String myComposition, int mySlotsLeft, boolean canUndo) {
    }

    public record Analysis(Player player, PriceRecommendation recommendation) {

        public String verdict() {
            if (recommendation.maxBid() == 0) {
                return "LASCIA";
            }
            return recommendation.margin() >= 0 ? "PRENDI" : "LASCIA";
        }

        public String marginLabel() {
            int margin = recommendation.margin();
            return (margin >= 0 ? "+" : "") + margin;
        }
    }

    public record MainPanel(List<Player> results, Analysis analysis, String message) {
    }

    /**
     * Fase completa: nessun partecipante ha piu' uno slot libero per quel ruolo.
     * {@code nextPhase} e' null se si e' gia' sull'ultima fase — allora non c'e' un
     * "vai alla prossima" da offrire, e dirlo comunque sarebbe un bottone che mente.
     */
    public record PhaseComplete(String phase, String nextPhase) {
    }

    /**
     * Una riga della home: quanto basta a riconoscere un'asta fra le altre — il suo
     * identificativo, quando e' stata scritta l'ultima volta, quanti acquisti contiene
     * e a che fase era arrivata.
     */
    public record AuctionCard(String id, String lastWritten, int purchases, String phase,
                              boolean selected) {
    }

    /**
     * Il popup del battitore: chi si sta battendo, il tetto oltre cui non conviene, e
     * le due preferenze che governano il countdown.
     *
     * <p>Il max bid e' calcolato una volta sola, all'apertura, e non si muove piu'
     * mentre si rilancia. Non e' una svista: e' un tetto che dipende da budget, slot e
     * alternative ancora disponibili, non da quanto si e' gia' offerto. Ricalcolarlo ad
     * ogni rilancio mostrerebbe un numero che insegue l'offerta, che e' precisamente il
     * comportamento da cui questo strumento deve proteggere.
     */
    public record Bidder(Player player, PriceRecommendation recommendation,
                         int timerSeconds, boolean beepEnabled) {
    }

    /**
     * Il battitore sulla pagina proiettata sullo schermo condiviso.
     *
     * <p>Un record separato da {@link Bidder}, e non lo stesso con un flag "nascondi il
     * max bid". La differenza e' l'intero punto: qui NON ESISTE un campo in cui il max
     * bid possa stare, quindi non puo' finire nel markup ne' per una svista in un
     * template, ne' per un ramo condizionale scritto male, ne' guardando il sorgente
     * della pagina. Un flag si dimentica; un campo assente no.
     *
     * <p>Chi aggiunge qui un campo che viene da una valutazione lo sta proiettando su
     * uno schermo che guardano tutti gli avversari.
     */
    public record PublicBidder(Player player, int timerSeconds, boolean beepEnabled) {
    }

    /** Una riga della pagina di riepilogo: un giocatore posseduto e il prezzo pagato. */
    public record RecapPlayer(long seq, String name, int price) {
    }

    /**
     * Una colonna della pagina di riepilogo: un partecipante, i crediti e gli slot che
     * gli restano, e i suoi giocatori raggruppati per ruolo nell'ordine P, D, C, A.
     */
    public record RecapColumn(String participantId, String participantName, boolean me,
                              int budgetRemaining, int slotsRemaining,
                              Map<Role, List<RecapPlayer>> byRole) {
    }
}
