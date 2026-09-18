package com.fantaagent.config;

import com.fantaagent.domain.league.Participant;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Assegna l'iniziale ai partecipanti che non ne hanno una.
 *
 * <p>L'iniziale non si chiede piu' a chi crea l'asta: nella SPA non compare da nessuna
 * parte, perche' rose, card squadra e battitore mostrano il nome per esteso. Serve
 * ancora al comando «giocatore prezzo iniziale» delle pagine /legacy, che da quella
 * lettera riconosce l'acquirente, e per questo deve restare unica.
 *
 * <p>Chi ne porta gia' una — un'asta creata prima, o /legacy stesso — se la tiene: qui
 * si riempiono solo i buchi, e mai riscrivendo quelle degli altri.
 */
public final class ParticipantInitials {

    private ParticipantInitials() {
    }

    /**
     * @return gli stessi partecipanti, con un'iniziale unica per ciascuno: la sua se
     *         gia' l'aveva ed e' libera, altrimenti una lettera del nome, altrimenti
     *         una lettera dell'alfabeto, altrimenti una cifra.
     */
    public static List<Participant> assign(List<Participant> members) {
        Set<Character> taken = new HashSet<>();
        List<Participant> out = new ArrayList<>(members.size());
        for (Participant p : members) {
            char own = Character.toUpperCase(p.initial());
            // Fra due partecipanti con la stessa lettera la tiene il primo: il secondo
            // ne riceve un'altra, invece di lasciarli entrambi in errore.
            char initial = !Character.isWhitespace(own) && taken.add(own)
                    ? own
                    : free(p.name(), taken);
            out.add(new Participant(p.id(), p.name(), initial, p.me()));
        }
        return List.copyOf(out);
    }

    private static char free(String name, Set<Character> taken) {
        String clean = name == null ? "" : name;
        for (int i = 0; i < clean.length(); i++) {
            char c = Character.toUpperCase(clean.charAt(i));
            if (Character.isLetterOrDigit(c) && taken.add(c)) {
                return c;
            }
        }
        for (char c = 'A'; c <= 'Z'; c++) {
            if (taken.add(c)) {
                return c;
            }
        }
        for (char c = '0'; c <= '9'; c++) {
            if (taken.add(c)) {
                return c;
            }
        }
        // Oltre 36 partecipanti le lettere finiscono: il validatore dira' che l'iniziale
        // e' duplicata, invece di far passare in silenzio due acquirenti indistinguibili
        // per il comando di /legacy.
        return '?';
    }
}
