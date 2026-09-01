package com.fantaagent.config;

import org.yaml.snakeyaml.Yaml;

import java.io.IOException;
import java.io.Reader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.Optional;

/**
 * Legge e scrive le preferenze del battitore su un file proprio.
 *
 * <p>Un file distinto da {@code league-settings.yml} perche' quello contiene le regole
 * di punteggio, che alimentano il motore di valutazione e che ad asta iniziata sono
 * bloccate. Mettere qui la durata di un countdown significherebbe legare una
 * preferenza di comodo a un vincolo che non le appartiene: non si potrebbe piu'
 * allungare il timer a meta' asta senza toccare un file che, a quel punto, non
 * dovrebbe piu' cambiare.
 *
 * <p>File assente significa "mai configurato", non errore: valgono i
 * {@link AuctionSettings#DEFAULTS}. File illeggibile e' invece un errore rumoroso, per
 * lo stesso motivo di {@link ScoringSettingsStore}: proseguire con impostazioni diverse
 * da quelle che l'utente crede di avere e' il modo peggiore di sbagliare.
 */
public class AuctionSettingsStore {

    public static final String FILE_NAME = "auction-settings.yml";

    private final Path file;

    public AuctionSettingsStore(Path dataDir) {
        this.file = dataDir.resolve(FILE_NAME);
    }

    public Path file() {
        return file;
    }

    public boolean exists() {
        return Files.exists(file);
    }

    @SuppressWarnings("unchecked")
    public Optional<AuctionSettings> load() {
        if (!Files.exists(file)) {
            return Optional.empty();
        }
        try (Reader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
            Object parsed = new Yaml().load(reader);
            if (!(parsed instanceof Map<?, ?> root)) {
                throw new IllegalStateException(
                        "il file " + file + " non contiene una mappa YAML");
            }
            Map<String, Object> map = (Map<String, Object>) root;
            return Optional.of(new AuctionSettings(
                    integer(map.get("bid-timer-seconds"), AuctionSettings.DEFAULTS.bidTimerSeconds()),
                    bool(map.get("beep-enabled"), AuctionSettings.DEFAULTS.beepEnabled())));
        } catch (IOException e) {
            throw new UncheckedIOException("impossibile leggere " + file, e);
        } catch (RuntimeException e) {
            throw new IllegalStateException(
                    "preferenze del battitore non interpretabili in " + file + ": "
                    + e.getMessage(), e);
        }
    }

    public void save(AuctionSettings s) {
        try {
            Path parent = file.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            Files.writeString(file, render(s), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("impossibile scrivere " + file, e);
        }
    }

    /** Scritto a mano invece che con un dump YAML, per un file stabile e leggibile. */
    private static String render(AuctionSettings s) {
        return """
               # Preferenze del battitore d'asta.
               # Scritto dall'applicazione dalla schermata Impostazioni.
               # Non entra in nessun calcolo: cambiarlo non muove alcuna raccomandazione.

               bid-timer-seconds: %d
               beep-enabled: %s
               """.formatted(s.bidTimerSeconds(), s.beepEnabled());
    }

    private static int integer(Object o, int fallback) {
        if (o instanceof Number n) {
            return n.intValue();
        }
        if (o == null) {
            return fallback;
        }
        return Integer.parseInt(o.toString().trim());
    }

    private static boolean bool(Object o, boolean fallback) {
        if (o instanceof Boolean b) {
            return b;
        }
        if (o == null) {
            return fallback;
        }
        return Boolean.parseBoolean(o.toString().trim());
    }
}
