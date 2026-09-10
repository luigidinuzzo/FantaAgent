package com.fantaagent.adapter.in.web;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Ogni collegamento delle pagine vecchie deve stare sotto {@code /legacy}.
 *
 * <p>Esiste perche' gli 87 test di questo package colpiscono i controller
 * direttamente e non passano mai per il markup: un {@code hx-post} rimasto alla
 * vecchia URL non fallirebbe da nessuna parte. E dal momento in cui la SPA ha il suo
 * fallback, non darebbe nemmeno piu' 404 — verrebbe inghiottito, servendo la pagina
 * React al posto di quella vecchia. Un bottone che cambia applicazione invece di
 * rompersi e' il difetto peggiore che questa tappa possa produrre.
 */
class LegacyLinkPrefixTest {

    /** I file statici non si spostano: restano serviti dalla radice. */
    private static final Set<String> STATIC = Set.of(
            "/app.css", "/app.js", "/bidder.js", "/recap.js", "/htmx.min.js");

    /**
     * Cattura la URL di un {@code hx-get}/{@code hx-post} o di un {@code @{...}} di
     * Thymeleaf, fermandosi prima della parentesi dei parametri.
     */
    private static final Pattern LINKS = Pattern.compile(
            "(?:hx-(?:get|post)=\"|th:(?:href|action|src)=\"@\\{|hx-(?:get|post)=\"@\\{)(/[^\"}(\\s]*)");

    @Test
    void ogniCollegamentoDellePagineVecchieStaSottoLegacy() throws IOException {
        List<String> fuoriPosto = new ArrayList<>();
        try (Stream<Path> files = Files.walk(Path.of("src/main/resources/templates"))) {
            for (Path file : files.filter(p -> p.toString().endsWith(".html")).toList()) {
                Matcher m = LINKS.matcher(Files.readString(file, StandardCharsets.UTF_8));
                while (m.find()) {
                    String url = m.group(1);
                    if (STATIC.contains(url) || url.startsWith("/legacy")) {
                        continue;
                    }
                    fuoriPosto.add(file.getFileName() + " -> " + url);
                }
            }
        }

        assertThat(fuoriPosto)
                .describedAs("collegamenti non prefissati: dopo il task 15 il fallback "
                        + "della SPA li inghiotte invece di dare 404")
                .isEmpty();
    }

    /** Se il pattern non trova niente, il test sopra passerebbe a vuoto. */
    @Test
    void ilPatternTrovaDavveroIColegamenti() throws IOException {
        String home = Files.readString(
                Path.of("src/main/resources/templates/home.html"), StandardCharsets.UTF_8);
        assertThat(LINKS.matcher(home).results()).isNotEmpty();
    }
}
