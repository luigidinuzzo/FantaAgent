package com.fantaagent.application.service.account;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Rallenta chi indovina password. Due contatori per tentativo — l'email e
 * l'indirizzo — perche' si indovina in due modi: molte password per una persona, o
 * una password per molte persone.
 */
public class LoginThrottle {

    static final int FREE_FAILURES = 5;
    static final Duration MAX_WAIT = Duration.ofMinutes(15);
    /** Oltre questa soglia si fa pulizia delle voci scadute, per non crescere senza limite. */
    static final int PRUNE_ABOVE = 10_000;

    private record Entry(int failures, Instant lockedUntil) {
    }

    private final Map<String, Entry> entries = new ConcurrentHashMap<>();
    private final Clock clock;

    public LoginThrottle(Clock clock) {
        this.clock = clock;
    }

    /** @throws TooManyAttemptsException se l'email o l'indirizzo devono ancora aspettare */
    public void check(String email, String address) {
        Instant now = clock.instant();
        for (String key : keys(email, address)) {
            Entry entry = entries.get(key);
            if (entry != null && entry.lockedUntil() != null && now.isBefore(entry.lockedUntil())) {
                throw new TooManyAttemptsException(Duration.between(now, entry.lockedUntil()));
            }
        }
    }

    public void failed(String email, String address) {
        Instant now = clock.instant();
        if (entries.size() > PRUNE_ABOVE) {
            entries.values().removeIf(e -> e.lockedUntil() == null || e.lockedUntil().isBefore(now));
        }
        for (String key : keys(email, address)) {
            entries.merge(key, new Entry(1, lockFor(1, now)),
                    (old, one) -> new Entry(old.failures() + 1, lockFor(old.failures() + 1, now)));
        }
    }

    public void succeeded(String email) {
        entries.remove(emailKey(email));
    }

    private static Instant lockFor(int failures, Instant now) {
        if (failures < FREE_FAILURES) {
            return null;
        }
        int exponent = Math.min(failures - FREE_FAILURES, 20);
        Duration wait = Duration.ofSeconds(1L << exponent);
        return now.plus(wait.compareTo(MAX_WAIT) > 0 ? MAX_WAIT : wait);
    }

    private static String[] keys(String email, String address) {
        return new String[]{emailKey(email), "ip:" + address};
    }

    private static String emailKey(String email) {
        return "email:" + (email == null ? "" : email.trim().toLowerCase(Locale.ROOT));
    }
}
