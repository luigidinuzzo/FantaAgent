package com.fantaagent.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * Le schermate Thymeleaf di {@code /legacy} e cio' che solo loro usano: l'asta
 * selezionata del processo e l'archivio su file. Abbandonate dal 17 settembre, restano
 * per confronto in locale e si accendono solo col profilo {@code legacy} — che non va
 * mai attivato su un'installazione raggiungibile da altri: quelle pagine non hanno
 * accesso ne' lega.
 */
@Configuration
@Profile("legacy")
public class LegacyConfig {

    @Bean
    public com.fantaagent.application.port.out.AuctionArchive auctionArchive(
            @org.springframework.beans.factory.annotation.Value("${fantaagent.data-dir:res}") String dataDir) {
        return new com.fantaagent.adapter.out.file.FileAuctionArchive(java.nio.file.Path.of(dataDir));
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
