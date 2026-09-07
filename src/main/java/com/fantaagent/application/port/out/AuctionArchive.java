package com.fantaagent.application.port.out;

import com.fantaagent.config.ScoringSettings;
import com.fantaagent.domain.league.Participant;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Le aste presenti sull'archivio, ciascuna col proprio log.
 *
 * <p>Questa porta apre file, non li riscrive: {@link #open} deve restituire uno store
 * posizionato sul log dell'asta chiesta senza troncarlo, rinominarlo o cancellarlo, e
 * non deve avere alcun modo di distruggere un log esistente. È l'unica garanzia che
 * "cambiare asta" non possa mai perdere un registro già scritto.
 */
public interface AuctionArchive {

    /** Identificatori delle aste trovate, in ordine stabile. */
    List<String> auctionIds();

    boolean exists(String auctionId);

    /**
     * Apre il log dell'asta indicata. Non crea nulla e non tocca il contenuto: il file
     * nasce, se non esiste, solo al primo append.
     */
    AuctionEventStore open(String auctionId);

    /** Ultima scrittura del log, se l'asta esiste. */
    Optional<Instant> lastWritten(String auctionId);

    /**
     * I partecipanti DI QUELL'ASTA, se ne ha di propri.
     *
     * <p>Ogni asta ha i suoi: nomi e iniziali appartengono alla serata, non
     * all'applicazione. Tenendoli in un'unica configurazione globale, configurare una
     * seconda asta riscriveva i nomi mostrati per la prima — gli acquisti restavano
     * corretti, perche' il registro li lega agli id, ma le rose comparivano intestate
     * alle persone sbagliate.
     *
     * <p>Vuoto per le aste scritte prima di questa separazione: li' si ricade sulla
     * configurazione generale, che e' il meglio che si possa fare senza inventare dati.
     */
    Optional<List<Participant>> participants(String auctionId);

    /** Fissa i partecipanti di quell'asta. */
    void saveParticipants(String auctionId, List<Participant> participants);

    /**
     * Le regole di punteggio DI QUELL'ASTA, se ne ha di proprie.
     *
     * <p>Stessa ragione dei partecipanti, con una posta piu' alta: da queste regole
     * discendono i punti attesi di ogni giocatore, quindi tenerle in un'unica
     * configurazione globale significava che configurare una nuova asta cambiava i
     * NUMERI mostrati per quelle vecchie — non solo le etichette. Una rosa gia' pagata
     * si sarebbe riletta con un modello che non era quello con cui era stata comprata.
     *
     * <p>Vuoto per le aste scritte prima di questa separazione.
     */
    Optional<ScoringSettings> scoring(String auctionId);

    /** Fissa le regole di punteggio di quell'asta. */
    void saveScoring(String auctionId, ScoringSettings settings);
}
