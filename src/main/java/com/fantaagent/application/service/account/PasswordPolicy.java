package com.fantaagent.application.service.account;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Lunghezza e lista nera, nient'altro. Le regole di composizione (una maiuscola, un
 * simbolo) spingono verso "Password1!" e non rendono niente piu' difficile da
 * indovinare; una frase lunga di sole minuscole e' molto meglio.
 */
public class PasswordPolicy {

    public static final int MIN_LENGTH = 10;
    public static final int MAX_LENGTH = 128;
    static final String LIST = "/security/common-passwords.txt";

    private final Set<String> common;

    public PasswordPolicy(Set<String> common) {
        this.common = common.stream().map(p -> p.toLowerCase(Locale.ROOT)).collect(Collectors.toUnmodifiableSet());
    }

    public static PasswordPolicy fromClasspath() {
        try (InputStream in = PasswordPolicy.class.getResourceAsStream(LIST)) {
            if (in == null) {
                throw new IllegalStateException("lista delle password comuni assente: " + LIST);
            }
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
                return new PasswordPolicy(reader.lines().map(String::trim)
                        .filter(line -> !line.isEmpty()).collect(Collectors.toSet()));
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** Le frasi da mostrare accanto al campo; vuota se la password va bene. */
    public List<String> problems(String password) {
        if (password == null || password.length() < MIN_LENGTH) {
            return List.of("La password deve avere almeno " + MIN_LENGTH + " caratteri.");
        }
        if (password.length() > MAX_LENGTH) {
            return List.of("La password non può superare " + MAX_LENGTH + " caratteri.");
        }
        if (common.contains(password.toLowerCase(Locale.ROOT))) {
            return List.of("Questa password è fra le più usate: scegline un'altra.");
        }
        return List.of();
    }
}
