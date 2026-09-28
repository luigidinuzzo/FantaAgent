package com.fantaagent.testsupport;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;
import java.nio.file.Path;

/**
 * Il DataSource quando non c'e' un database vero: nei test e con {@code ./run.sh}.
 *
 * <p>Vive nel classpath dei test apposta: il jar di produzione non contiene ne' questa
 * classe ne' i binari di Postgres. La scansione dei componenti la trova perche' sta
 * sotto {@code com.fantaagent}; la condizione la accende solo dove una delle due
 * proprieta' di {@code src/test/resources/config} lo chiede.
 */
@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "fantaagent.db.embedded")
public class EmbeddedPostgresConfig {

    @Bean
    DataSource dataSource(@Value("${fantaagent.db.embedded}") String mode,
                          @Value("${fantaagent.db.embedded-dir:data/pg}") String dir) {
        return switch (mode) {
            case "per-context" -> SharedPostgres.freshDatabase();
            case "persistent" -> PersistentPostgres.start(Path.of(dir));
            default -> throw new IllegalStateException(
                    "fantaagent.db.embedded non riconosciuto: " + mode);
        };
    }
}
