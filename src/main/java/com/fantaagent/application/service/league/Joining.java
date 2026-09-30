package com.fantaagent.application.service.league;

import com.fantaagent.application.port.out.InitialTakenException;
import com.fantaagent.application.port.out.LeagueMember;
import com.fantaagent.application.port.out.LeagueRepository;
import com.fantaagent.application.port.out.MemberRole;

import java.time.Clock;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** L'ingresso di un membro, uguale per chi apre il link d'invito e per chi viene accettato. */
final class Joining {

    private Joining() {
    }

    /**
     * L'iniziale scelta dal server si calcola sui membri di adesso: due persone che
     * entrano nello stesso istante possono ricevere la stessa lettera, e la seconda
     * trova il vincolo. Si riprova sui membri aggiornati. Un'iniziale mandata da chi
     * entra invece e' la sua: se e' presa, lo deve sapere (409).
     */
    static void insertMember(LeagueRepository leagues, Clock clock, UUID leagueId, UUID userId,
                             String teamName, String initial) {
        boolean chosen = initial != null && !initial.isBlank();
        for (int attempt = 1; ; attempt++) {
            Set<Character> taken = leagues.members(leagueId).stream()
                    .map(LeagueMember::initial).collect(Collectors.toSet());
            try {
                leagues.insertMember(new LeagueMember(leagueId, userId, MemberRole.MEMBER,
                        teamName.trim(), LeagueService.initialOr(initial, teamName, taken),
                        clock.instant(), null));
                return;
            } catch (InitialTakenException e) {
                if (chosen || attempt == 3) {
                    throw e;
                }
            }
        }
    }
}
