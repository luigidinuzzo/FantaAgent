package com.fantaagent.ingestion;

import com.fantaagent.domain.player.Player;

import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Risolve un nome grezzo proveniente da una fonte statistica sull'id del listone.
 *
 * <p>Strategia, in ordine: alias esplicito, match esatto normalizzato, match sul solo
 * cognome quando è univoco, altrimenti rifiuto. Se nessun criterio produce un candidato
 * univoco la risoluzione fallisce: un match sbagliato è peggio di un match mancante,
 * perché assegna statistiche altrui a un giocatore.
 *
 * <p>Il matching approssimato è deliberatamente assente qui: durante l'importazione
 * nessuno verifica il risultato, quindi un match sbagliato è invisibile e corrompe ogni
 * proiezione costruita su quelle statistiche. Cognomi brevi collidono facilmente a
 * distanza 1 (es. "Conte"/"Conti", "Grassi"/"Grossi"), producendo risposte sicure ma
 * errate. I nomi non risolti confluiscono nel report di riconciliazione che l'utente
 * legge prima dell'asta e corregge con un alias: un match mancante è visibile ed
 * economico, un match sbagliato è invisibile e costoso. Il matching approssimato resta
 * nel progetto solo in {@code domain.search.PlayerSearch}, dove è l'utente a verificare
 * il nome proposto prima di agire — non aggiungerlo qui.
 */
public final class NameResolver {

    private final Map<String, String> byNormalizedName = new HashMap<>();
    private final Set<String> ambiguousNames = new HashSet<>();
    private final Map<String, String> bySurname = new HashMap<>();
    private final Set<String> ambiguousSurnames = new HashSet<>();
    private final Map<String, String> aliases = new HashMap<>();

    public NameResolver(Collection<Player> players, Map<String, String> aliases) {
        for (Player p : players) {
            String normalized = normalize(p.name());
            String previousByName = byNormalizedName.putIfAbsent(normalized, p.id());
            if (previousByName != null && !previousByName.equals(p.id())) {
                ambiguousNames.add(normalized);
            }
            String surname = surnameOf(normalized);
            String previousBySurname = bySurname.putIfAbsent(surname, p.id());
            if (previousBySurname != null && !previousBySurname.equals(p.id())) {
                ambiguousSurnames.add(surname);
            }
        }
        aliases.forEach((raw, id) -> this.aliases.put(normalize(raw), id));
    }

    public static String normalize(String raw) {
        return com.fantaagent.domain.search.TextNormalizer.normalize(raw);
    }

    public Optional<String> resolve(String rawName) {
        String normalized = normalize(rawName);

        String alias = aliases.get(normalized);
        if (alias != null) {
            return Optional.of(alias);
        }
        if (!ambiguousNames.contains(normalized)) {
            String exact = byNormalizedName.get(normalized);
            if (exact != null) {
                return Optional.of(exact);
            }
        }
        String surname = surnameOf(normalized);
        if (!ambiguousSurnames.contains(surname)) {
            String bySurnameMatch = bySurname.get(surname);
            if (bySurnameMatch != null) {
                return Optional.of(bySurnameMatch);
            }
        }
        return Optional.empty();
    }

    /** Primo token del nome normalizzato: nel listone il cognome precede l'iniziale. */
    private static String surnameOf(String normalized) {
        int space = normalized.indexOf(' ');
        return space < 0 ? normalized : normalized.substring(0, space);
    }
}
