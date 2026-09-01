package com.fantaagent.adapter.in.web;

import com.fantaagent.adapter.in.web.dto.ViewModels;
import com.fantaagent.domain.auction.AuctionState;
import com.fantaagent.domain.player.Role;

/**
 * "La fase corrente e' completa?", nella forma che serve alle viste.
 *
 * <p>Estratto qui perche' due pagine lo chiedono — la schermata d'asta sul portatile
 * e la pagina BATTITORE proiettata — e due calcoli separati finirebbero per non
 * concordare: una potrebbe annunciare la fase chiusa mentre l'altra la mostra ancora
 * aperta, sullo stesso registro e nello stesso istante.
 *
 * <p>Il risultato e' pubblico: dire che nessuno ha piu' uno slot libero per un ruolo
 * e' un fatto che tutti in stanza possono ricavare contando le rose.
 */
final class PhaseCompletion {

    private PhaseCompletion() {
    }

    /**
     * @return null se la fase corrente non e' completa — le viste distinguono cosi'
     *         "nulla da annunciare" da "annuncio da mostrare". {@code nextPhase} e'
     *         null sull'ultima fase: li' non c'e' un "vai alla prossima" da offrire, e
     *         proporlo comunque sarebbe un bottone che mente.
     */
    static ViewModels.PhaseComplete of(AuctionState state) {
        Role phase = state.currentPhase();
        if (!state.isPhaseComplete(phase)) {
            return null;
        }
        return new ViewModels.PhaseComplete(phase.name(),
                state.rules().nextPhase(phase).map(Role::name).orElse(null));
    }
}
