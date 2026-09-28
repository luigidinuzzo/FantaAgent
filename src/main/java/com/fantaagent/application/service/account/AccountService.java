package com.fantaagent.application.service.account;

import com.fantaagent.application.port.out.Mailer;
import com.fantaagent.application.port.out.PasswordHasher;
import com.fantaagent.application.port.out.UserAccount;
import com.fantaagent.application.port.out.UserRepository;
import com.fantaagent.application.port.out.UserToken;
import com.fantaagent.application.port.out.UserTokenRepository;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;

/**
 * Registrazione, verifica dell'indirizzo, recupero della password.
 *
 * <p><b>L'account e' usabile subito.</b> La verifica non blocca niente: la sera
 * dell'asta nessuno deve restare fuori perche' l'email e' finita nello spam. Serve
 * per recuperare la password — un link di recupero mandato a un indirizzo mai
 * confermato potrebbe finire a chiunque l'abbia scritto.
 */
public class AccountService {

    static final Duration VERIFY_TTL = Duration.ofDays(7);
    static final Duration RESET_TTL = Duration.ofHours(1);
    static final int MAX_NAME = 40;
    static final int MAX_EMAIL = 254;

    private final UserRepository users;
    private final UserTokenRepository tokens;
    private final PasswordHasher hasher;
    private final PasswordPolicy policy;
    private final Mailer mailer;
    private final Clock clock;
    private final String publicUrl;

    public AccountService(UserRepository users, UserTokenRepository tokens, PasswordHasher hasher,
                          PasswordPolicy policy, Mailer mailer, Clock clock, String publicUrl) {
        this.users = users;
        this.tokens = tokens;
        this.hasher = hasher;
        this.policy = policy;
        this.mailer = mailer;
        this.clock = clock;
        this.publicUrl = publicUrl.endsWith("/") ? publicUrl.substring(0, publicUrl.length() - 1) : publicUrl;
    }

    public UserAccount register(String email, String password, String displayName) {
        String cleanEmail = email == null ? "" : email.trim();
        String cleanName = displayName == null ? "" : displayName.trim();
        Map<String, List<String>> errors = new LinkedHashMap<>();
        if (!looksLikeEmail(cleanEmail)) {
            add(errors, "email", "Scrivi un indirizzo email valido.");
        }
        nameProblems(cleanName).forEach(p -> add(errors, "displayName", p));
        policy.problems(password).forEach(p -> add(errors, "password", p));
        if (!errors.isEmpty()) {
            throw new InvalidAccountDataException(errors);
        }
        UserAccount user = new UserAccount(UUID.randomUUID(), cleanEmail, hasher.hash(password),
                cleanName, null, clock.instant());
        users.insert(user);
        sendVerification(user);
        return user;
    }

    /** @throws NoSuchElementException se l'utente non esiste piu' */
    public UserAccount byId(UUID id) {
        return users.byId(id).orElseThrow();
    }

    public UserAccount rename(UUID id, String displayName) {
        String clean = displayName == null ? "" : displayName.trim();
        List<String> problems = nameProblems(clean);
        if (!problems.isEmpty()) {
            throw new InvalidAccountDataException(Map.of("displayName", problems));
        }
        users.updateDisplayName(id, clean);
        return byId(id);
    }

    public void resendVerification(UUID userId) {
        users.byId(userId).filter(u -> !u.emailVerified()).ifPresent(this::sendVerification);
    }

    public void verifyEmail(String token) {
        UserToken used = consume(token, UserToken.Purpose.VERIFY_EMAIL);
        users.markVerified(used.userId(), clock.instant());
    }

    /**
     * Stessa risposta che l'indirizzo esista o no, e che sia verificato o no: la
     * schermata non deve diventare un modo per sapere chi e' iscritto.
     */
    public void requestPasswordReset(String email) {
        users.byEmail(email == null ? "" : email.trim())
                .filter(UserAccount::emailVerified)
                .ifPresent(user -> {
                    String token = issue(user.id(), UserToken.Purpose.RESET_PASSWORD, RESET_TTL);
                    mailer.send(user.email(), "Nuova password per FantaAgent",
                            "Ciao " + user.displayName() + ",\n\n"
                            + "per scegliere una nuova password apri questo link:\n"
                            + publicUrl + "/nuova-password?token=" + token + "\n\n"
                            + "Il link vale un'ora. Se non l'hai chiesto tu, ignora questo messaggio:"
                            + " la tua password resta quella di prima.\n");
                });
    }

    /**
     * La password nuova si controlla PRIMA di usare il link: una password troppo corta
     * non deve bruciare un link che vale un'ora.
     *
     * @return l'utente la cui password e' cambiata, per chiuderne le sessioni
     */
    public UUID resetPassword(String token, String newPassword) {
        List<String> problems = policy.problems(newPassword);
        if (!problems.isEmpty()) {
            throw new InvalidAccountDataException(Map.of("password", problems));
        }
        UserToken used = consume(token, UserToken.Purpose.RESET_PASSWORD);
        users.updatePassword(used.userId(), hasher.hash(newPassword));
        return used.userId();
    }

    private void sendVerification(UserAccount user) {
        String token = issue(user.id(), UserToken.Purpose.VERIFY_EMAIL, VERIFY_TTL);
        mailer.send(user.email(), "Conferma il tuo indirizzo su FantaAgent",
                "Ciao " + user.displayName() + ",\n\n"
                + "per confermare il tuo indirizzo apri questo link:\n"
                + publicUrl + "/verifica-email?token=" + token + "\n\n"
                + "Il link vale 7 giorni. Se non ti sei registrato tu, ignora questo messaggio.\n");
    }

    private String issue(UUID userId, UserToken.Purpose purpose, Duration ttl) {
        String token = Tokens.generate();
        Instant now = clock.instant();
        tokens.insert(new UserToken(UUID.randomUUID(), userId, purpose, Tokens.hash(token),
                now, now.plus(ttl), null));
        return token;
    }

    private UserToken consume(String token, UserToken.Purpose purpose) {
        Instant now = clock.instant();
        UserToken found = tokens.byHash(Tokens.hash(token == null ? "" : token))
                .filter(t -> t.purpose() == purpose)
                .filter(t -> t.usedAt() == null)
                .filter(t -> t.expiresAt().isAfter(now))
                .orElseThrow(InvalidTokenException::new);
        if (!tokens.markUsed(found.id(), now)) {
            throw new InvalidTokenException();
        }
        return found;
    }

    private static List<String> nameProblems(String name) {
        if (name.isEmpty()) {
            return List.of("Scrivi il tuo nome.");
        }
        if (name.length() > MAX_NAME) {
            return List.of("Il nome non può superare " + MAX_NAME + " caratteri.");
        }
        return List.of();
    }

    static boolean looksLikeEmail(String s) {
        return s.length() <= MAX_EMAIL && s.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+");
    }

    private static void add(Map<String, List<String>> errors, String key, String message) {
        errors.computeIfAbsent(key, k -> new ArrayList<>()).add(message);
    }
}
