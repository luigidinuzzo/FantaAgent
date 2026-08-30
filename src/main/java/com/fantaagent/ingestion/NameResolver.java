package com.fantaagent.ingestion;

import com.fantaagent.domain.player.Player;

import java.text.Normalizer;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Risolve un nome grezzo proveniente da una fonte statistica sull'id del listone.
 *
 * <p>Strategia, in ordine: alias esplicito, match esatto normalizzato, match sul solo
 * cognome quando è univoco, distanza di edit 1 quando il candidato è unico. Se nessun
 * criterio produce un candidato univoco la risoluzione fallisce: un match sbagliato è
 * peggio di un match mancante, perché assegna statistiche altrui a un giocatore.
 */
public final class NameResolver {

    private final Map<String, String> byNormalizedName = new HashMap<>();
    private final Map<String, String> bySurname = new HashMap<>();
    private final Set<String> ambiguousSurnames = new HashSet<>();
    private final Map<String, String> aliases = new HashMap<>();

    public NameResolver(Collection<Player> players, Map<String, String> aliases) {
        for (Player p : players) {
            String normalized = normalize(p.name());
            byNormalizedName.put(normalized, p.id());
            String surname = surnameOf(normalized);
            String previous = bySurname.putIfAbsent(surname, p.id());
            if (previous != null && !previous.equals(p.id())) {
                ambiguousSurnames.add(surname);
            }
        }
        aliases.forEach((raw, id) -> this.aliases.put(normalize(raw), id));
    }

    public static String normalize(String raw) {
        String decomposed = Normalizer.normalize(raw, Normalizer.Form.NFD);
        String withoutAccents = decomposed.replaceAll("\\p{M}", "");
        String cleaned = withoutAccents.toLowerCase(Locale.ITALIAN)
                .replaceAll("[^a-z0-9 ]", "")
                .replaceAll("\\s+", " ")
                .trim();
        return cleaned;
    }

    public Optional<String> resolve(String rawName) {
        String normalized = normalize(rawName);

        String alias = aliases.get(normalized);
        if (alias != null) {
            return Optional.of(alias);
        }
        String exact = byNormalizedName.get(normalized);
        if (exact != null) {
            return Optional.of(exact);
        }
        String surname = surnameOf(normalized);
        if (!ambiguousSurnames.contains(surname)) {
            String bySurnameMatch = bySurname.get(surname);
            if (bySurnameMatch != null) {
                return Optional.of(bySurnameMatch);
            }
        }
        return uniqueCloseMatch(normalized);
    }

    private Optional<String> uniqueCloseMatch(String normalized) {
        String found = null;
        for (Map.Entry<String, String> entry : byNormalizedName.entrySet()) {
            if (editDistanceAtMostOne(normalized, entry.getKey())
                    || editDistanceAtMostOne(normalized, surnameOf(entry.getKey()))) {
                if (found != null && !found.equals(entry.getValue())) {
                    return Optional.empty();
                }
                found = entry.getValue();
            }
        }
        return Optional.ofNullable(found);
    }

    /** Primo token del nome normalizzato: nel listone il cognome precede l'iniziale. */
    private static String surnameOf(String normalized) {
        int space = normalized.indexOf(' ');
        return space < 0 ? normalized : normalized.substring(0, space);
    }

    /** Vero se le stringhe differiscono per al più una sostituzione, inserimento o cancellazione. */
    static boolean editDistanceAtMostOne(String a, String b) {
        if (a.equals(b)) {
            return true;
        }
        int la = a.length();
        int lb = b.length();
        if (Math.abs(la - lb) > 1) {
            return false;
        }
        int i = 0;
        int j = 0;
        boolean usedEdit = false;
        while (i < la && j < lb) {
            if (a.charAt(i) == b.charAt(j)) {
                i++;
                j++;
                continue;
            }
            if (usedEdit) {
                return false;
            }
            usedEdit = true;
            if (la > lb) {
                i++;
            } else if (lb > la) {
                j++;
            } else {
                i++;
                j++;
            }
        }
        return true;
    }
}
