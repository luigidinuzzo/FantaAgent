package com.fantaagent.config;

import com.fantaagent.domain.league.Participant;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/** L'iniziale non si chiede piu': si calcola dal nome, e resta unica. */
class ParticipantInitialsTest {

    private static Participant p(String id, String name, char initial) {
        return new Participant(id, name, initial, false);
    }

    private static List<Character> initialsOf(List<Participant> members) {
        return ParticipantInitials.assign(members).stream().map(Participant::initial).toList();
    }

    @Test
    void senzaInizialeUsaLaPrimaLetteraDelNome() {
        assertThat(initialsOf(List.of(p("1", "Anna", ' '), p("2", "Bruno", ' '))))
                .containsExactly('A', 'B');
    }

    /** «Team 1», «Team 2»: stessa lettera iniziale, iniziali diverse. */
    @Test
    void aParitaDiPrimaLetteraPrendeLaSuccessivaLiberaDelNome() {
        assertThat(initialsOf(List.of(
                p("1", "Team 1", ' '), p("2", "Team 2", ' '), p("3", "Team 3", ' '))))
                .containsExactly('T', 'E', 'A');
    }

    /** Chi ha gia' un'iniziale se la tiene: le aste create prima non cambiano acquirente. */
    @Test
    void unInizialeGiaSceltaResta() {
        assertThat(initialsOf(List.of(p("1", "Anna", 'Z'), p("2", "Bruno", ' '))))
                .containsExactly('Z', 'B');
    }

    @Test
    void fraDueUgualiLaTieneIlPrimo() {
        assertThat(initialsOf(List.of(p("1", "Marco", 'M'), p("2", "Matteo", 'M'))))
                .containsExactly('M', 'A');
    }

    @Test
    void leInizialiSonoSempreUniche() {
        List<Participant> venti = IntStream.rangeClosed(1, 20)
                .mapToObj(i -> p("p" + i, "Team " + i, ' '))
                .toList();
        assertThat(initialsOf(venti)).doesNotHaveDuplicates().hasSize(20);
    }

    @Test
    void unNomeVuotoRiceveComunqueUnInizialeLibera() {
        assertThat(initialsOf(List.of(p("1", "Anna", ' '), p("2", "", ' '))))
                .containsExactly('A', 'B');
    }
}
