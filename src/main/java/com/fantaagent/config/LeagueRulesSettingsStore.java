package com.fantaagent.config;

import com.fantaagent.domain.player.Role;
import org.yaml.snakeyaml.Yaml;

import java.io.IOException;
import java.io.Reader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.EnumMap;
import java.util.Map;
import java.util.Optional;

/** Le regole della lega di un'asta: {@code league-rules.yml} nella sua cartella. */
public class LeagueRulesSettingsStore {

    public static final String FILE_NAME = "league-rules.yml";

    private final Path file;

    public LeagueRulesSettingsStore(Path dir) {
        this.file = dir.resolve(FILE_NAME);
    }

    public Path file() {
        return file;
    }

    @SuppressWarnings("unchecked")
    public Optional<LeagueRulesSettings> load() {
        if (!Files.exists(file)) {
            return Optional.empty();
        }
        try (Reader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
            Object parsed = new Yaml().load(reader);
            if (!(parsed instanceof Map<?, ?> root)) {
                throw new IllegalStateException("il file " + file + " non contiene una mappa YAML");
            }
            Map<String, Object> map = (Map<String, Object>) root;
            Map<Role, Integer> slots = new EnumMap<>(Role.class);
            if (map.get("slots") instanceof Map<?, ?> raw) {
                for (Role role : Role.values()) {
                    Object v = raw.get(role.name());
                    // Un ruolo assente resta assente: lo rifiuta LeagueRules, con il
                    // nome del ruolo, invece di inventargli un numero qui.
                    if (v != null) {
                        slots.put(role, integer(v));
                    }
                }
            }
            return Optional.of(new LeagueRulesSettings(integer(map.get("budget")), slots));
        } catch (IOException e) {
            throw new UncheckedIOException("impossibile leggere " + file, e);
        } catch (RuntimeException e) {
            throw new IllegalStateException(
                    "regole della lega non interpretabili in " + file + ": " + e.getMessage(), e);
        }
    }

    public void save(LeagueRulesSettings s) {
        try {
            Files.createDirectories(file.getParent());
            Files.writeString(file, """
                    # Regole della lega per questa asta.
                    # Scritto dall'applicazione alla creazione dell'asta. Le squadre sono i
                    # partecipanti in league-members.yml; l'ordine delle fasi e' globale.

                    budget: %d
                    slots:
                      P: %d
                      D: %d
                      C: %d
                      A: %d
                    """.formatted(s.budget(), s.slots().get(Role.P), s.slots().get(Role.D),
                    s.slots().get(Role.C), s.slots().get(Role.A)), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("impossibile scrivere " + file, e);
        }
    }

    private static int integer(Object o) {
        if (o instanceof Number n) {
            return n.intValue();
        }
        if (o == null) {
            throw new IllegalStateException("valore mancante");
        }
        return Integer.parseInt(o.toString().trim());
    }
}
