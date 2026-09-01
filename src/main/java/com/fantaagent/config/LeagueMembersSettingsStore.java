package com.fantaagent.config;

import com.fantaagent.domain.league.Participant;
import org.yaml.snakeyaml.Yaml;

import java.io.IOException;
import java.io.Reader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Legge e scrive i partecipanti della lega su un file separato da application.yml,
 * seguendo esattamente il pattern di {@link ScoringSettingsStore}: un file distinto
 * perché è una scelta dell'utente che l'applicazione riscrive da sola, non
 * configurazione di progetto versionata.
 *
 * <p>File assente significa "nessuna scelta ancora fatta": si usano i partecipanti di
 * application.yml. File illeggibile è un errore rumoroso, per lo stesso motivo per cui
 * lo è per le regole di punteggio: proseguire con partecipanti diversi da quelli che
 * l'utente crede di avere impostato è il modo peggiore di sbagliare, specialmente
 * perché gli acquisti già registrati fanno riferimento agli id dei partecipanti.
 */
public class LeagueMembersSettingsStore {

    public static final String FILE_NAME = "league-members.yml";

    private final Path file;

    public LeagueMembersSettingsStore(Path dataDir) {
        this.file = dataDir.resolve(FILE_NAME);
    }

    public Path file() {
        return file;
    }

    public boolean exists() {
        return Files.exists(file);
    }

    @SuppressWarnings("unchecked")
    public Optional<List<Participant>> load() {
        if (!Files.exists(file)) {
            return Optional.empty();
        }
        try (Reader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
            Object parsed = new Yaml().load(reader);
            if (!(parsed instanceof Map<?, ?> root)) {
                throw new IllegalStateException(
                        "il file dei partecipanti " + file + " non contiene una mappa YAML");
            }
            Map<String, Object> map = (Map<String, Object>) root;
            Object rawMembers = map.get("members");
            if (!(rawMembers instanceof List<?> list)) {
                throw new IllegalStateException(
                        "il file dei partecipanti " + file + " non contiene la lista members");
            }

            List<Participant> members = new ArrayList<>();
            for (Object row : list) {
                if (row instanceof Map<?, ?> r) {
                    String id = String.valueOf(r.get("id"));
                    String name = String.valueOf(r.get("name"));
                    String initialRaw = String.valueOf(r.get("initial"));
                    char initial = initialRaw.isBlank() ? ' ' : initialRaw.trim().charAt(0);
                    members.add(new Participant(id, name, initial, bool(r.get("me"), false)));
                }
            }
            return Optional.of(List.copyOf(members));
        } catch (IOException e) {
            throw new UncheckedIOException("impossibile leggere " + file, e);
        } catch (RuntimeException e) {
            throw new IllegalStateException(
                    "partecipanti non interpretabili in " + file + ": " + e.getMessage(), e);
        }
    }

    public void save(List<Participant> members) {
        try {
            Path parent = file.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            Files.writeString(file, render(members), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("impossibile scrivere " + file, e);
        }
    }

    /** Scritto a mano invece che con un dump YAML, per un file stabile e leggibile. */
    private static String render(List<Participant> members) {
        StringBuilder sb = new StringBuilder();
        sb.append("# Partecipanti della lega.\n");
        sb.append("# Scritto dall'applicazione dalla schermata Impostazioni: modificarlo\n");
        sb.append("# a mano funziona, ma i valori vengono riletti solo al prossimo avvio.\n");
        sb.append("# L'id di ciascun partecipante e' quello a cui il registro dell'asta\n");
        sb.append("# lega gli acquisti gia' fatti: non modificarlo a mano ad asta iniziata.\n\n");
        sb.append("members:\n");
        for (Participant p : members) {
            sb.append("  - id: ").append(quote(p.id())).append('\n');
            sb.append("    name: ").append(quote(p.name())).append('\n');
            sb.append("    initial: ").append(quote(String.valueOf(p.initial()))).append('\n');
            sb.append("    me: ").append(p.me()).append('\n');
        }
        return sb.toString();
    }

    private static String quote(String s) {
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
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
