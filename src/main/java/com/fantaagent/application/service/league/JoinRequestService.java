package com.fantaagent.application.service.league;

import com.fantaagent.application.port.out.JoinRequest;
import com.fantaagent.application.port.out.JoinRequestRepository;
import com.fantaagent.application.port.out.LeagueMatch;
import com.fantaagent.application.port.out.LeagueRepository;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * L'altra porta d'ingresso, per chi non ha il link: cerca la lega per nome, chiede di
 * entrare, e l'amministratore accetta o rifiuta. Accettare fa entrare con la squadra
 * scritta nella richiesta; rifiutare la cancella, e chi l'aveva mandata la vede
 * sparire dalle sue.
 */
public class JoinRequestService {

    /** Sotto questa lunghezza la ricerca troverebbe mezze leghe d'Italia. */
    static final int MIN_QUERY = 3;
    static final int MAX_RESULTS = 8;

    private final JoinRequestRepository requests;
    private final LeagueRepository leagues;
    private final Clock clock;

    public JoinRequestService(JoinRequestRepository requests, LeagueRepository leagues, Clock clock) {
        this.requests = requests;
        this.leagues = leagues;
        this.clock = clock;
    }

    public List<LeagueMatch> search(UUID viewer, String text) {
        String clean = text == null ? "" : text.trim();
        if (clean.length() < MIN_QUERY) {
            return List.of();
        }
        return requests.search(clean, viewer, MAX_RESULTS);
    }

    /**
     * Chi e' gia' membro non manda niente: la richiesta non servirebbe.
     *
     * @throws NotLeagueMemberException se la lega non esiste
     */
    public void request(UUID userId, UUID leagueId, String teamName) {
        if (leagues.byId(leagueId).isEmpty()) {
            throw new NotLeagueMemberException(leagueId);
        }
        if (leagues.member(leagueId, userId).isPresent()) {
            return;
        }
        Map<String, List<String>> problems = LeagueService.memberProblems(teamName, null, false);
        if (!problems.isEmpty()) {
            throw new InvalidLeagueDataException(problems);
        }
        requests.upsert(new JoinRequest(leagueId, userId, teamName.trim(), clock.instant(), null, null));
    }

    public List<JoinRequest> mine(UUID userId) {
        return requests.byUser(userId);
    }

    /** Ritirare una richiesta che non c'e' non fa niente e non e' un errore. */
    public void withdraw(UUID userId, UUID leagueId) {
        requests.delete(leagueId, userId);
    }

    public List<JoinRequest> pending(LeagueAccess access) {
        access.requireAdmin();
        return requests.byLeague(access.leagueId());
    }

    /** Le richieste aperte di ciascuna lega, fra quelle date, che si amministra. */
    public Map<UUID, Integer> pendingCounts(List<LeagueAccess> mine) {
        return requests.countByLeague(mine.stream().filter(LeagueAccess::isAdmin)
                .map(LeagueAccess::leagueId).toList());
    }

    /**
     * Prima il membro, poi la richiesta, senza una transazione attorno: l'ingresso
     * riprova se due persone ricevono la stessa iniziale, e in Postgres un comando
     * fallito rende inutilizzabile la transazione in cui sta. Se la cancellazione non
     * riesce la richiesta resta, ma di un membro non si legge (vedi
     * {@code JdbcJoinRequestRepository}) e sparisce quando esce dalla lega.
     */
    public void approve(LeagueAccess access, UUID userId) {
        access.requireAdmin();
        JoinRequest request = requests.find(access.leagueId(), userId)
                .orElseThrow(JoinRequestGoneException::new);
        Joining.insertMember(leagues, clock, access.leagueId(), userId, request.teamName(), null);
        requests.delete(access.leagueId(), userId);
    }

    /** Rifiutare una richiesta gia' ritirata non e' un errore: il risultato e' lo stesso. */
    public void reject(LeagueAccess access, UUID userId) {
        access.requireAdmin();
        requests.delete(access.leagueId(), userId);
    }
}
