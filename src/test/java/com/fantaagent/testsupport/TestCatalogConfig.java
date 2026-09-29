package com.fantaagent.testsupport;

import com.fantaagent.application.port.out.PlayerCatalog;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/**
 * Il catalogo sintetico di {@link Fixtures#catalog()} — quaranta giocatori per ruolo,
 * senza statistiche — al posto di quello vero letto da {@code res/}. Un test non deve
 * dipendere da file non versionati (i listoni {@code .xlsx} sono ignorati da git) ne'
 * rischiare di scriverci sopra: con questo bean {@code @Primary} il contesto Spring del
 * test non tocca affatto {@code res/}.
 *
 * <p>{@code @TestConfiguration} non entra nello scanning dei componenti: un test che
 * non la importa esplicitamente con {@code @Import} continua a vedere il catalogo che
 * {@code fantaagent.data-dir} gli indica, come sempre.
 */
@TestConfiguration
public class TestCatalogConfig {

    @Bean
    @Primary
    public PlayerCatalog testPlayerCatalog() {
        return Fixtures.catalog();
    }
}
