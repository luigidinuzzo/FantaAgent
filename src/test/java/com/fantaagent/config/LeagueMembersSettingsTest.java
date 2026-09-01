package com.fantaagent.config;

import com.fantaagent.domain.league.Participant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Persistenza e validazione dei partecipanti della lega — stesso pattern di
 * {@link ScoringSettingsTest}: file separato, assente = nessuna scelta ancora fatta,
 * illeggibile = errore rumoroso.
 */
class LeagueMembersSettingsTest {

    @TempDir
    Path tmp;

    private static final List<Participant> LEAGUE = List.of(
            new Participant("me", "Io", 'I', true),
            new Participant("marco", "Marco", 'M', false),
            new Participant("luca", "Luca", 'L', false));

    @Test
    void namesSurviveASaveAndReload() {
        LeagueMembersSettingsStore store = new LeagueMembersSettingsStore(tmp);

        store.save(LEAGUE);
        List<Participant> reloaded = store.load().orElseThrow();

        assertThat(reloaded).hasSize(3);
        assertThat(reloaded.get(0).id()).isEqualTo("me");
        assertThat(reloaded.get(0).name()).isEqualTo("Io");
        assertThat(reloaded.get(0).initial()).isEqualTo('I');
        assertThat(reloaded.get(0).me()).isTrue();
        assertThat(reloaded.get(1).name()).isEqualTo("Marco");
        assertThat(reloaded.get(1).me()).isFalse();
    }

    @Test
    void anAbsentFileMeansNoChoiceYetRatherThanAnError() {
        assertThat(new LeagueMembersSettingsStore(tmp).load()).isEmpty();
    }

    @Test
    void anUnreadableFileFailsLoudlyNamingIt() throws Exception {
        Files.writeString(tmp.resolve(LeagueMembersSettingsStore.FILE_NAME), "questo non e' una mappa");

        assertThatThrownBy(() -> new LeagueMembersSettingsStore(tmp).load())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining(LeagueMembersSettingsStore.FILE_NAME);
    }

    @Test
    void editingTheDisplayNameKeepsTheIdStable() {
        LeagueMembersSettingsStore store = new LeagueMembersSettingsStore(tmp);
        store.save(LEAGUE);

        List<Participant> renamed = List.of(
                new Participant("me", "Gigi", 'I', true),
                new Participant("marco", "Marco", 'M', false),
                new Participant("luca", "Luca", 'L', false));
        store.save(renamed);

        List<Participant> reloaded = store.load().orElseThrow();
        assertThat(reloaded.get(0).id()).isEqualTo("me");
        assertThat(reloaded.get(0).name()).isEqualTo("Gigi");
    }

    @Test
    void acceptsTheRealLeague() {
        assertThat(LeagueMembersSettingsValidator.validate(LEAGUE)).isEmpty();
    }

    @Test
    void duplicateInitialsAreRejectedNamingTheClash() {
        List<Participant> withClash = List.of(
                new Participant("me", "Io", 'M', true),
                new Participant("marco", "Marco", 'M', false));

        List<String> errors = LeagueMembersSettingsValidator.validate(withClash);

        assertThat(errors).anySatisfy(e -> {
            assertThat(e).contains("M");
            assertThat(e).contains("Io");
            assertThat(e).contains("Marco");
        });
    }

    @Test
    void exactlyOneOwnerIsRequired() {
        List<String> noOwner = LeagueMembersSettingsValidator.validate(List.of(
                new Participant("me", "Io", 'I', false),
                new Participant("marco", "Marco", 'M', false)));
        assertThat(noOwner).anySatisfy(e -> assertThat(e).containsIgnoringCase("tu"));

        List<String> twoOwners = LeagueMembersSettingsValidator.validate(List.of(
                new Participant("me", "Io", 'I', true),
                new Participant("marco", "Marco", 'M', true)));
        assertThat(twoOwners).anySatisfy(e -> assertThat(e).containsIgnoringCase("tu"));
    }

    @Test
    void blankNamesAreRejected() {
        List<String> errors = LeagueMembersSettingsValidator.validate(List.of(
                new Participant("me", "  ", 'I', true),
                new Participant("marco", "Marco", 'M', false)));

        assertThat(errors).anySatisfy(e -> assertThat(e).contains("me"));
    }
}
