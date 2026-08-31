package com.fantaagent.config;

import com.fantaagent.domain.player.Role;
import org.yaml.snakeyaml.Yaml;

import java.io.IOException;
import java.io.Reader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Legge e scrive le impostazioni di punteggio su un file separato da application.yml.
 *
 * <p>Un file distinto e non l'application.yml perché quello è configurazione di
 * progetto, versionata; questo è una scelta dell'utente che cambia una volta l'anno e
 * che l'applicazione riscrive da sola. Tenerli separati significa che un aggiornamento
 * del progetto non sovrascrive le regole della lega, e che le regole della lega non
 * finiscono in un diff.
 *
 * <p>File assente significa "nessuna scelta ancora fatta", non errore: si usano i valori
 * di application.yml. File illeggibile invece è un errore rumoroso, perché proseguire
 * con regole diverse da quelle che l'utente crede di avere impostato è il modo peggiore
 * di sbagliare.
 */
public class ScoringSettingsStore {

    public static final String FILE_NAME = "league-settings.yml";

    private final Path file;

    public ScoringSettingsStore(Path dataDir) {
        this.file = dataDir.resolve(FILE_NAME);
    }

    public Path file() {
        return file;
    }

    public boolean exists() {
        return Files.exists(file);
    }

    @SuppressWarnings("unchecked")
    public Optional<ScoringSettings> load() {
        if (!Files.exists(file)) {
            return Optional.empty();
        }
        try (Reader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
            Object parsed = new Yaml().load(reader);
            if (!(parsed instanceof Map<?, ?> root)) {
                throw new IllegalStateException(
                        "il file delle impostazioni " + file + " non contiene una mappa YAML");
            }
            Map<String, Object> map = (Map<String, Object>) root;

            List<ScoringSettings.Step> steps = new ArrayList<>();
            Object rawSteps = map.get("thresholds");
            if (rawSteps instanceof List<?> list) {
                for (Object row : list) {
                    if (row instanceof Map<?, ?> r) {
                        steps.add(new ScoringSettings.Step(
                                number(r.get("min-average")), number(r.get("bonus"))));
                    }
                }
            }

            Map<Role, Double> goalBonus = new EnumMap<>(Role.class);
            Object rawBonus = map.get("goal-bonus");
            if (rawBonus instanceof Map<?, ?> b) {
                for (Role role : Role.values()) {
                    Object v = b.get(role.name());
                    if (v != null) {
                        goalBonus.put(role, number(v));
                    }
                }
            }
            for (Role role : Role.values()) {
                goalBonus.putIfAbsent(role, 0.0);
            }

            return Optional.of(new ScoringSettings(
                    bool(map.get("defence-modifier-enabled"), true),
                    (int) number(map.getOrDefault("defenders-counted", 3)),
                    steps,
                    goalBonus,
                    number(map.getOrDefault("assist", 0.0)),
                    number(map.getOrDefault("penalty-scored", 0.0)),
                    number(map.getOrDefault("penalty-missed", 0.0)),
                    number(map.getOrDefault("penalty-saved", 0.0)),
                    number(map.getOrDefault("yellow-card", 0.0)),
                    number(map.getOrDefault("red-card", 0.0)),
                    number(map.getOrDefault("goal-conceded", 0.0)),
                    number(map.getOrDefault("clean-sheet", 0.0)),
                    bool(map.get("confirmed"), false)));
        } catch (IOException e) {
            throw new UncheckedIOException("impossibile leggere " + file, e);
        } catch (RuntimeException e) {
            throw new IllegalStateException(
                    "impostazioni di lega non interpretabili in " + file + ": " + e.getMessage(), e);
        }
    }

    public void save(ScoringSettings s) {
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
    private static String render(ScoringSettings s) {
        StringBuilder sb = new StringBuilder();
        sb.append("# Regole di punteggio della lega.\n");
        sb.append("# Scritto dall'applicazione dalla schermata Impostazioni: modificarlo\n");
        sb.append("# a mano funziona, ma i valori vengono riletti solo al prossimo avvio.\n");
        sb.append("# Il bonus della tabella e' in FANTAPUNTI a giornata, non in gol.\n\n");
        sb.append("defence-modifier-enabled: ").append(s.defenceModifierEnabled()).append('\n');
        sb.append("defenders-counted: ").append(s.defendersCounted()).append('\n');
        sb.append("confirmed: ").append(s.confirmed()).append('\n');
        sb.append("clean-sheet: ").append(num(s.cleanSheet())).append('\n');
        sb.append("assist: ").append(num(s.assist())).append('\n');
        sb.append("penalty-scored: ").append(num(s.penaltyScored())).append('\n');
        sb.append("penalty-missed: ").append(num(s.penaltyMissed())).append('\n');
        sb.append("penalty-saved: ").append(num(s.penaltySaved())).append('\n');
        sb.append("yellow-card: ").append(num(s.yellowCard())).append('\n');
        sb.append("red-card: ").append(num(s.redCard())).append('\n');
        sb.append("goal-conceded: ").append(num(s.goalConceded())).append('\n');
        sb.append("goal-bonus:\n");
        for (Role role : Role.values()) {
            sb.append("  ").append(role.name()).append(": ")
              .append(num(s.goalBonus().getOrDefault(role, 0.0))).append('\n');
        }
        sb.append("thresholds:\n");
        for (ScoringSettings.Step step : s.thresholds()) {
            sb.append("  - { min-average: ").append(num(step.minAverage()))
              .append(", bonus: ").append(num(step.bonus())).append(" }\n");
        }
        return sb.toString();
    }

    private static String num(double v) {
        return String.format(Locale.ROOT, "%s", v);
    }

    private static double number(Object o) {
        if (o instanceof Number n) {
            return n.doubleValue();
        }
        if (o == null) {
            return 0.0;
        }
        return Double.parseDouble(o.toString().trim().replace(',', '.'));
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
