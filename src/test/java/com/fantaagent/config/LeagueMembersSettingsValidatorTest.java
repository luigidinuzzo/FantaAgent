package com.fantaagent.config;

import com.fantaagent.domain.league.Participant;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@code validateByField}, e la garanzia che {@code validate} ne resti l'appiattimento
 * fedele — stesso pattern di {@link AuctionSettingsValidatorTest}. I casi "per sezione"
 * restano in {@link LeagueMembersSettingsTest}.
 */
class LeagueMembersSettingsValidatorTest {

    private static final List<Participant> LEAGUE = List.of(
            new Participant("me", "Io", 'I', true),
            new Participant("marco", "Marco", 'M', false),
            new Participant("luca", "Luca", 'L', false));

    @Test
    void impostazioniValideNonProduconoChiavi() {
        assertThat(LeagueMembersSettingsValidator.validateByField(LEAGUE)).isEmpty();
    }

    @Test
    void nessunPartecipanteStaSottoLaChiaveDellInsieme() {
        Map<String, List<String>> errors = LeagueMembersSettingsValidator.validateByField(List.of());

        assertThat(errors).containsOnlyKeys("participants");
        assertThat(errors.get("participants")).hasSize(1);
    }

    /**
     * L'iniziale duplicata e' un errore dell'INSIEME e non di una riga: riguarda due
     * partecipanti, e attribuirlo a uno solo dei due manderebbe a correggere quello
     * sbagliato.
     */
    @Test
    void unIniazialeDuplicataStaSottoLaChiaveDellInsieme() {
        List<Participant> withClash = List.of(
                new Participant("me", "Io", 'M', true),
                new Participant("marco", "Marco", 'M', false));

        Map<String, List<String>> errors = LeagueMembersSettingsValidator.validateByField(withClash);

        assertThat(errors).containsOnlyKeys("participants");
        assertThat(errors.get("participants")).anySatisfy(
                e -> assertThat(e).contains("M").contains("Io").contains("Marco"));
    }

    @Test
    void nessunoSegnatoComeTuStaSottoLaChiaveDellInsieme() {
        Map<String, List<String>> errors = LeagueMembersSettingsValidator.validateByField(List.of(
                new Participant("me", "Io", 'I', false),
                new Participant("marco", "Marco", 'M', false)));

        assertThat(errors).containsOnlyKeys("participants");
        assertThat(errors.get("participants")).anySatisfy(e -> assertThat(e).containsIgnoringCase("tu"));
    }

    @Test
    void unNomeVuotoStaSottoLaChiaveDiQuellaRiga() {
        Map<String, List<String>> errors = LeagueMembersSettingsValidator.validateByField(List.of(
                new Participant("me", "  ", 'I', true),
                new Participant("marco", "Marco", 'M', false)));

        assertThat(errors).containsOnlyKeys("participants[me].name");
        assertThat(errors.get("participants[me].name")).hasSize(1);
    }

    @Test
    void unIniazialeMancanteStaSottoLaChiaveDiQuellaRiga() {
        Map<String, List<String>> errors = LeagueMembersSettingsValidator.validateByField(List.of(
                new Participant("me", "Io", ' ', true),
                new Participant("marco", "Marco", 'M', false)));

        assertThat(errors).containsOnlyKeys("participants[me].initial");
        assertThat(errors.get("participants[me].initial")).hasSize(1);
    }

    /**
     * La ragione per cui il metodo vecchio resta: SettingsController lo usa, e i suoi
     * test asseriscono queste frasi. Appiattire non deve cambiarle ne' riordinarle.
     *
     * <p>Pin sulle frasi LETTERALI, nell'ORDINE letterale — non su un confronto con
     * {@code validateByField(...).values()...}: quel confronto sarebbe tautologico,
     * perche' {@code validate} e' DEFINITO come quel flatten e concorderebbe con se
     * stesso anche se un controllo futuro venisse spostato altrove nel metodo.
     * "me" ha nome vuoto E iniziale mancante (due errori di riga, nell'ordine in
     * cui il ciclo li controlla su quella riga); poi "A" e' duplicata fra anna e
     * bruno (un errore dell'insieme); poi nessuno e' segnato come «tu» (un altro
     * errore dell'insieme) — quattro frasi, attraverso tutti i rami tranne
     * l'insieme vuoto e il "piu' di un proprietario", gia' pinnati altrove.
     */
    @Test
    void ilMetodoVecchioResituisceLeFrasiLetteraliNellOrdineDeiControlli() {
        List<Participant> rotti = List.of(
                new Participant("me", " ", ' ', false),
                new Participant("anna", "Anna", 'A', false),
                new Participant("bruno", "Bruno", 'A', false));

        assertThat(LeagueMembersSettingsValidator.validate(rotti)).containsExactly(
                "Il partecipante con id «me» non può avere un nome vuoto.",
                "Il partecipante « » non ha un'iniziale.",
                "L'iniziale «A» è usata da più partecipanti (Anna, Bruno): deve essere "
                        + "unica perché il comando «giocatore prezzo iniziale» la usa per "
                        + "riconoscere l'acquirente.",
                "Nessun partecipante è segnato come «tu»: deve essercene esattamente uno.");
    }
}
