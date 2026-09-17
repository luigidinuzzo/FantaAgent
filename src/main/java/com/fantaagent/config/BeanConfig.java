package com.fantaagent.config;

import com.fantaagent.domain.league.LeagueRules;
import com.fantaagent.domain.league.Participant;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class BeanConfig {

    /**
     * Le regole PREDEFINITE: le squadre sono i partecipanti del modello. Servono alla
     * validazione d'avvio; quelle in uso stanno nello snapshot del runtime, per asta.
     */
    @Bean
    public LeagueRules leagueRules(LeagueProperties props, List<Participant> participants) {
        return new LeagueRules(participants.size(), props.budget(), props.slots(), props.phases());
    }

    /**
     * Se {@code league-members.yml} esiste, i suoi partecipanti hanno la precedenza su
     * quelli di application.yml — stesso pattern di {@link SettingsConfig#scoringRules}.
     *
     * <p>Questo bean è il valore INIZIALE, usato dalla validazione d'avvio e dalla prima
     * costruzione di {@link com.fantaagent.application.service.AuctionRuntime}. Da lì in
     * poi i partecipanti in vigore sono quelli dello snapshot del runtime, che
     * {@code loadParticipants} rilegge ad ogni salvataggio: gli id restano fissi, quindi
     * il registro dell'asta conserva il suo significato, e solo nome e iniziale cambiano.
     */
    @Bean
    public List<Participant> participants(LeagueProperties props, LeagueMembersSettingsStore store) {
        return loadParticipants(props, store);
    }

    /** Gli stessi partecipanti che costruirebbe il bean, riletti da disco su richiesta. */
    public static List<Participant> loadParticipants(LeagueProperties props,
                                                     LeagueMembersSettingsStore store) {
        java.util.Optional<List<Participant>> stored = store.load();
        if (stored.isEmpty()) {
            org.slf4j.LoggerFactory.getLogger(BeanConfig.class)
                    .info("partecipanti: nessun {} trovato, uso i valori di application.yml",
                            LeagueMembersSettingsStore.FILE_NAME);
            return props.members().stream()
                    .map(m -> new Participant(m.id(), m.name(), m.initial(), m.me()))
                    .toList();
        }
        List<Participant> members = stored.get();
        List<String> errors = LeagueMembersSettingsValidator.validate(members);
        if (!errors.isEmpty()) {
            throw new IllegalStateException(
                    "partecipanti della lega non validi in " + store.file() + ":\n  - "
                    + String.join("\n  - ", errors));
        }
        org.slf4j.LoggerFactory.getLogger(BeanConfig.class)
                .info("partecipanti letti da {} ({} partecipanti)", store.file(), members.size());
        return members;
    }

    @Bean
    public com.fantaagent.application.port.out.PlayerCatalog playerCatalog(
            @org.springframework.beans.factory.annotation.Value("${fantaagent.data-dir:res}") String dataDir) {
        com.fantaagent.ingestion.CatalogLoader.LoadedCatalog loaded =
                new com.fantaagent.ingestion.CatalogLoader().load(java.nio.file.Path.of(dataDir));
        org.slf4j.LoggerFactory.getLogger(BeanConfig.class)
                .info("catalogo caricato:\n{}", loaded.report().render());
        return loaded.catalog();
    }

    @Bean
    public com.fantaagent.application.port.out.AuctionArchive auctionArchive(
            @org.springframework.beans.factory.annotation.Value("${fantaagent.data-dir:res}") String dataDir) {
        return new com.fantaagent.adapter.out.file.FileAuctionArchive(java.nio.file.Path.of(dataDir));
    }

    /**
     * Il modello da cui parte ogni asta, e il ripiego per quelle che non hanno un file:
     * application.yml e i file globali in data-dir, riletti a ogni chiamata.
     */
    @Bean
    public ConfigAuctionTemplate auctionTemplate(LeagueProperties props,
                                                 ScoringSettingsStore scoringStore,
                                                 LeagueMembersSettingsStore membersStore,
                                                 AuctionSettingsStore auctionStore) {
        return new ConfigAuctionTemplate(props, scoringStore, membersStore, auctionStore);
    }

    /**
     * L'unico posto da cui i servizi prendono asta selezionata, regole e catena di
     * valutazione. Nessuna asta selezionata all'avvio, di proposito: e' la home a
     * chiedere quale aprire.
     */
    @Bean
    public com.fantaagent.application.service.AuctionRuntime auctionRuntime(
            com.fantaagent.application.port.out.PlayerCatalog catalog,
            LeagueProperties props,
            ConfigAuctionTemplate template,
            com.fantaagent.application.port.out.AuctionArchive archive) {
        return new com.fantaagent.application.service.AuctionRuntime(
                catalog, props.scoring().seasonWeights(), props.phases(), template, archive);
    }

    @Bean
    public com.fantaagent.application.service.AuctionService auctionService(
            com.fantaagent.application.port.out.PlayerCatalog catalog,
            com.fantaagent.application.service.AuctionRuntime runtime) {
        return new com.fantaagent.application.service.AuctionService(
                catalog, runtime.scopes());
    }

    @Bean
    public com.fantaagent.application.service.PlayerAnalysisService playerAnalysisService(
            com.fantaagent.application.port.out.PlayerCatalog catalog,
            com.fantaagent.application.service.AuctionRuntime runtime,
            com.fantaagent.application.service.AuctionService auction) {
        return new com.fantaagent.application.service.PlayerAnalysisService(
                catalog, runtime.chains(), auction);
    }

    @Bean
    public com.fantaagent.application.service.PlayerSearchService playerSearchService(
            com.fantaagent.application.port.out.PlayerCatalog catalog,
            com.fantaagent.application.service.AuctionRuntime runtime,
            com.fantaagent.application.service.AuctionService auction,
            com.fantaagent.application.service.PlayerAnalysisService analysis) {
        return new com.fantaagent.application.service.PlayerSearchService(
                catalog, runtime.chains(), auction, analysis);
    }
}
