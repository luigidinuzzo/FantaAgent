package com.fantaagent.domain.search;

import java.util.Optional;
import java.util.OptionalInt;

/**
 * Grammatica della barra unica: {@code <giocatore> [prezzo] [iniziale partecipante]}.
 *
 * <p>Il ruolo non compare mai: è implicito nella fase in corso. L'iniziale del
 * partecipante è riconosciuta solo dopo un prezzo, perché nel listone esistono nomi che
 * terminano con una lettera isolata ("Thuram M.").
 */
public final class CommandParser {

    private CommandParser() {
    }

    public static ParsedCommand parse(String raw) {
        String cleaned = raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
        if (cleaned.isEmpty()) {
            return new ParsedCommand("", OptionalInt.empty(), Optional.empty());
        }
        String[] tokens = cleaned.split(" ");

        if (tokens.length >= 3
                && isSingleLetter(tokens[tokens.length - 1])
                && isPositiveInteger(tokens[tokens.length - 2])) {
            String term = join(tokens, tokens.length - 2);
            return new ParsedCommand(term,
                    OptionalInt.of(Integer.parseInt(tokens[tokens.length - 2])),
                    Optional.of(Character.toUpperCase(tokens[tokens.length - 1].charAt(0))));
        }
        if (tokens.length >= 2 && isPositiveInteger(tokens[tokens.length - 1])) {
            return new ParsedCommand(join(tokens, tokens.length - 1),
                    OptionalInt.of(Integer.parseInt(tokens[tokens.length - 1])),
                    Optional.empty());
        }
        return new ParsedCommand(cleaned, OptionalInt.empty(), Optional.empty());
    }

    private static String join(String[] tokens, int count) {
        return String.join(" ", java.util.Arrays.copyOfRange(tokens, 0, count));
    }

    private static boolean isSingleLetter(String token) {
        return token.length() == 1 && Character.isLetter(token.charAt(0));
    }

    private static boolean isPositiveInteger(String token) {
        if (token.isEmpty() || token.length() > 4) {
            return false;
        }
        for (int i = 0; i < token.length(); i++) {
            if (!Character.isDigit(token.charAt(i))) {
                return false;
            }
        }
        return Integer.parseInt(token) > 0;
    }
}
