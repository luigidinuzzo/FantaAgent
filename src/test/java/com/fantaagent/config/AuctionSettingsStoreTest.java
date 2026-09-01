package com.fantaagent.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Sempre su @TempDir: i file veri sotto res/ sono la configurazione di lega e il
 * registro d'asta dell'utente, e un test che li riscrivesse distruggerebbe dati che
 * non esistono altrove.
 */
class AuctionSettingsStoreTest {

    @TempDir
    Path dir;

    @Test
    void fileAssenteSignificaNessunaSceltaFatta() {
        assertThat(new AuctionSettingsStore(dir).load()).isEmpty();
    }

    @Test
    void salvaEritornaGliStessiValori() {
        AuctionSettingsStore store = new AuctionSettingsStore(dir);
        store.save(new AuctionSettings(8, false));

        assertThat(store.load()).contains(new AuctionSettings(8, false));
    }

    @Test
    void ilFileScrittoEleggibileAMano() throws Exception {
        AuctionSettingsStore store = new AuctionSettingsStore(dir);
        store.save(new AuctionSettings(12, true));

        String content = Files.readString(store.file(), StandardCharsets.UTF_8);
        assertThat(content).contains("bid-timer-seconds: 12").contains("beep-enabled: true");
    }

    /**
     * Una chiave mancante non e' un errore: il file puo' essere stato scritto da una
     * versione precedente che non conosceva ancora quella preferenza, e rifiutarlo
     * costringerebbe a cancellarlo a mano.
     */
    @Test
    void chiaveMancanteRicadeSulDefault() throws Exception {
        AuctionSettingsStore store = new AuctionSettingsStore(dir);
        Files.writeString(store.file(), "bid-timer-seconds: 7\n", StandardCharsets.UTF_8);

        Optional<AuctionSettings> loaded = store.load();

        assertThat(loaded).isPresent();
        assertThat(loaded.get().bidTimerSeconds()).isEqualTo(7);
        assertThat(loaded.get().beepEnabled()).isEqualTo(AuctionSettings.DEFAULTS.beepEnabled());
    }

    /**
     * Un file illeggibile deve fermare l'applicazione invece di far finta di niente:
     * proseguire in silenzio coi default significherebbe un timer diverso da quello
     * che l'utente crede di avere impostato, senza che nulla glielo dica.
     */
    @Test
    void fileNonInterpretabileEunErroreRumoroso() throws Exception {
        AuctionSettingsStore store = new AuctionSettingsStore(dir);
        Files.writeString(store.file(), "questo non e' una mappa\n", StandardCharsets.UTF_8);

        assertThatThrownBy(store::load)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining(AuctionSettingsStore.FILE_NAME);
    }
}
