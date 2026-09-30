package com.fantaagent.application.service.league;

import com.fantaagent.application.port.out.AuctionTemplate;
import com.fantaagent.application.port.out.League;
import com.fantaagent.application.port.out.LeagueMember;
import com.fantaagent.application.port.out.LeagueRepository;
import com.fantaagent.application.port.out.MemberRole;
import com.fantaagent.application.port.out.Transactions;
import com.fantaagent.config.AuctionSettings;
import com.fantaagent.config.LeagueRulesSettings;
import com.fantaagent.config.ScoringSettings;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

public class LeagueService {

    static final int MAX_LEAGUE_NAME = 60;
    static final int MAX_TEAM_NAME = 40;

    private final LeagueRepository leagues;
    private final AuctionTemplate template;
    private final Transactions tx;
    private final Clock clock;

    public LeagueService(LeagueRepository leagues, AuctionTemplate template, Transactions tx, Clock clock) {
        this.leagues = leagues;
        this.template = template;
        this.tx = tx;
        this.clock = clock;
    }

    /**
     * La lega nasce coi valori del modello — gli stessi da cui partivano le aste locali
     * — e con chi la crea come amministratore e primo membro. Le due righe insieme o
     * nessuna: una lega senza amministratore non la potrebbe gestire nessuno.
     */
    public LeagueAccess create(UUID userId, String name, String teamName, String initial) {
        String cleanName = name == null ? "" : name.trim();
        Map<String, List<String>> errors = new LinkedHashMap<>();
        if (cleanName.isEmpty()) {
            add(errors, "name", "Dai un nome alla lega.");
        } else if (cleanName.length() > MAX_LEAGUE_NAME) {
            add(errors, "name", "Il nome della lega non può superare " + MAX_LEAGUE_NAME + " caratteri.");
        }
        errors.putAll(memberProblems(teamName, initial, false));
        if (!errors.isEmpty()) {
            throw new InvalidLeagueDataException(errors);
        }
        Instant now = clock.instant();
        League league = new League(UUID.randomUUID(), cleanName, userId, now,
                template.rules(), template.scoring(), template.bidder());
        LeagueMember admin = new LeagueMember(league.id(), userId, MemberRole.ADMIN,
                teamName.trim(), initialOr(initial, teamName, Set.of()), now, null);
        tx.run(() -> {
            leagues.insert(league);
            leagues.insertMember(admin);
        });
        return access(league.id(), userId);
    }

    public List<LeagueAccess> mine(UUID userId) {
        List<LeagueAccess> mine = new ArrayList<>();
        for (LeagueMember membership : leagues.membershipsOf(userId)) {
            leagues.byId(membership.leagueId())
                    .ifPresent(league -> mine.add(new LeagueAccess(league, membership)));
        }
        mine.sort(Comparator.comparing(a -> a.league().name().toLowerCase(Locale.ROOT)));
        return List.copyOf(mine);
    }

    /** @throws NotLeagueMemberException se la lega non esiste o l'utente non ne fa parte */
    public LeagueAccess access(UUID leagueId, UUID userId) {
        League league = leagues.byId(leagueId).orElseThrow(() -> new NotLeagueMemberException(leagueId));
        LeagueMember me = leagues.member(leagueId, userId)
                .orElseThrow(() -> new NotLeagueMemberException(leagueId));
        return new LeagueAccess(league, me);
    }

    public League rename(LeagueAccess access, String name) {
        access.requireAdmin();
        String clean = name == null ? "" : name.trim();
        if (clean.isEmpty() || clean.length() > MAX_LEAGUE_NAME) {
            throw new InvalidLeagueDataException(Map.of("name", List.of(clean.isEmpty()
                    ? "Dai un nome alla lega."
                    : "Il nome della lega non può superare " + MAX_LEAGUE_NAME + " caratteri.")));
        }
        League renamed = access.league().withName(clean);
        leagues.update(renamed);
        return renamed;
    }

    /** Valori gia' validati da chi chiama: i validatori per campo stanno in {@code config}. */
    public League updateDefaults(LeagueAccess access, LeagueRulesSettings rules,
                                 ScoringSettings scoring, AuctionSettings bidder) {
        access.requireAdmin();
        League updated = access.league().withDefaults(rules, scoring, bidder);
        leagues.update(updated);
        return updated;
    }

    public List<LeagueMember> members(LeagueAccess access) {
        return leagues.members(access.leagueId());
    }

    /**
     * Nome della squadra e iniziale: gli stessi controlli per chi crea, per chi entra e
     * per i posti di un'asta.
     *
     * @param initialRequired false per chi crea o entra in una lega, dove l'iniziale se
     *        manca la sceglie {@link #initialOr}; true per i posti di un'asta, che la
     *        riportano sempre
     */
    public static Map<String, List<String>> memberProblems(String teamName, String initial,
                                                           boolean initialRequired) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        String team = teamName == null ? "" : teamName.trim();
        if (team.isEmpty()) {
            add(errors, "teamName", "Scrivi il nome della tua squadra.");
        } else if (team.length() > MAX_TEAM_NAME) {
            add(errors, "teamName", "Il nome della squadra non può superare " + MAX_TEAM_NAME + " caratteri.");
        }
        String letter = initial == null ? "" : initial.trim();
        if ((initialRequired || !letter.isEmpty())
                && (letter.length() != 1 || !Character.isLetter(letter.charAt(0)))) {
            add(errors, "initial", "L'iniziale deve essere una lettera.");
        }
        return errors;
    }

    public static char initialOf(String initial) {
        return Character.toUpperCase(initial.trim().charAt(0));
    }

    /**
     * L'iniziale di chi entra: quella che ha mandato, se l'ha mandata; altrimenti la
     * sceglie il server.
     *
     * <p>L'app non la chiede piu': rose, banco e proiezione mostrano il nome per esteso,
     * e l'iniziale serve solo al comando testuale delle pagine /legacy, che da quella
     * lettera riconosce l'acquirente. Deve pero' restare unica nella lega (vincolo
     * {@code league_member_initial_key}): la prima lettera del nome della squadra che
     * nessuno ha ancora, poi la prima libera dell'alfabeto, poi una cifra.
     */
    public static char initialOr(String initial, String teamName, Set<Character> taken) {
        String letter = initial == null ? "" : initial.trim();
        if (!letter.isEmpty()) {
            return Character.toUpperCase(letter.charAt(0));
        }
        String team = teamName == null ? "" : teamName;
        for (int i = 0; i < team.length(); i++) {
            char c = Character.toUpperCase(team.charAt(i));
            if (c >= 'A' && c <= 'Z' && !taken.contains(c)) {
                return c;
            }
        }
        for (char c = 'A'; c <= 'Z'; c++) {
            if (!taken.contains(c)) {
                return c;
            }
        }
        for (char c = '0'; c <= '9'; c++) {
            if (!taken.contains(c)) {
                return c;
            }
        }
        throw new InvalidLeagueDataException(Map.of("initial", List.of("La lega è al completo.")));
    }

    private static void add(Map<String, List<String>> errors, String key, String message) {
        errors.computeIfAbsent(key, k -> new ArrayList<>()).add(message);
    }
}
