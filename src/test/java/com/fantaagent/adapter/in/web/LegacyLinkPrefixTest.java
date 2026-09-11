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
 *
 * <p><b>Cosa NON vede questo guardiano.</b> {@link #LINKS} richiede {@code @{}
 * immediatamente dopo la virgoletta di apertura: un'espressione ternaria come
 * {@code th:href="${setup} ? @{/legacy} : @{/asta}"} inizia invece con
 * {@code ${setup}}, quindi l'intero attributo — entrambi i rami, non solo il secondo —
 * resta invisibile. L'unica occorrenza reale (in {@code settings.html}) e' stata
 * trovata e corretta a mano; non c'e' verifica automatica che ne impedisca una nuova.
 *
 * <p>Due lacune in piu', nessuna delle due un caso reale oggi (la revisione ha grepato
 * il repository): {@link #LINKS} intercetta solo gli attributi Thymeleaf
 * {@code th:href}/{@code th:action}/{@code th:src} — un {@code href="/asta"} scritto
 * come attributo HTML letterale, senza {@code th:}, non e' visto. E fra i verbi htmx,
 * l'alternanza copre solo quelli davvero in uso in questo progetto
 * ({@code hx-get}/{@code hx-post}/{@code hx-delete}/{@code hx-put}/{@code hx-patch}/
 * {@code hx-push-url}): un attributo htmx futuro fuori da questo elenco resterebbe
 * comunque invisibile, cosi' come resterebbe invisibile qualunque URL scritta in un
 * posto che non sia uno di questi attributi (es. dentro {@code hx-vals} o uno script
 * inline nel template).
 */
class LegacyLinkPrefixTest {

    /** I file statici non si spostano: restano serviti dalla radice. */
    private static final Set<String> STATIC = Set.of(
            "/app.css", "/app.js", "/bidder.js", "/recap.js", "/htmx.min.js");

    /**
     * Cattura la URL di un {@code hx-get}/{@code hx-post}/{@code hx-delete}/
     * {@code hx-put}/{@code hx-patch}/{@code hx-push-url} o di un {@code @{...}} di
     * Thymeleaf, fermandosi prima della parentesi dei parametri. Vedi il Javadoc di
     * classe per i casi che questo pattern non copre.
     */
    private static final Pattern LINKS = Pattern.compile(
            "(?:hx-(?:get|post|delete|put|patch|push-url)=\"|th:(?:href|action|src)=\"@\\{"
            + "|hx-(?:get|post|delete|put|patch|push-url)=\"@\\{)(/[^\"}(\\s]*)");

    /**
     * Cattura il target di un redirect assoluto nel Java del package: sia
     * {@code return "redirect:/..."} sia {@code new ModelAndView("redirect:/...")}.
     */
    private static final Pattern JAVA_REDIRECT = Pattern.compile("redirect:(/[^\"\\s]*)");

    /**
     * Cattura il valore letterale passato come secondo argomento a
     * {@code setHeader(...)} quando e' un percorso applicativo, ad esempio
     * {@code response.setHeader("HX-Redirect", "/...")}. Una costante come
     * {@code STATE_CHANGED_EVENT} non e' una stringa letterale e non viene catturata:
     * e' voluto, non e' un indirizzo.
     */
    private static final Pattern JAVA_HEADER_PATH = Pattern.compile(
            "setHeader\\([^,]+,\\s*\"(/[^\"]*)\"\\)");

    /**
     * Cattura la URL di un {@code htmx.ajax('VERBO', '/...')} o di un
     * {@code fetch('/...')} negli script statici — la terza sede in cui vive un
     * indirizzo delle pagine vecchie, dopo i template e il Java del package. E'
     * quella che questo guardiano non guardava affatto: due scorciatoie da tastiera
     * di {@code app.js} sono rimaste puntate a {@code /undo} e
     * {@code /fragments/targets} invece che a {@code /legacy/...} e nessun test se ne
     * accorgeva, perche' htmx non applica lo swap su una risposta d'errore e il
     * fallimento resta silenzioso.
     */
    private static final Pattern JS_CALL = Pattern.compile(
            "(?:htmx\\.ajax\\('[A-Z]+',\\s*'|fetch\\(')(/[^'\"\\s]*)");

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

    /**
     * Stesso controllo del test sui template, ma sul Java del package: un
     * {@code redirect:/...} o un header con un percorso letterale, dimenticati alla
     * radice, non passano mai per il markup e restano invisibili al guardiano sopra.
     */
    @Test
    void ilCodiceJavaDellePagineVecchieNonRimandaAllaRadice() throws IOException {
        List<String> fuoriPosto = new ArrayList<>();
        try (Stream<Path> files = Files.walk(Path.of("src/main/java/com/fantaagent/adapter/in/web"))) {
            for (Path file : files.filter(p -> p.toString().endsWith(".java")).toList()) {
                String text = Files.readString(file, StandardCharsets.UTF_8);
                collectFuoriPosto(file, text, JAVA_REDIRECT, fuoriPosto);
                collectFuoriPosto(file, text, JAVA_HEADER_PATH, fuoriPosto);
            }
        }

        assertThat(fuoriPosto)
                .describedAs("indirizzi Java non prefissati: stessa scomparsa nel fallback "
                        + "della SPA del test sui template, ma un redirect o un header nel "
                        + "codice non passa mai per il markup")
                .isEmpty();
    }

    private static void collectFuoriPosto(Path file, String text, Pattern pattern,
                                          List<String> fuoriPosto) {
        Matcher m = pattern.matcher(text);
        while (m.find()) {
            String url = m.group(1);
            if (STATIC.contains(url) || url.startsWith("/legacy")) {
                continue;
            }
            fuoriPosto.add(file.getFileName() + " -> " + url);
        }
    }

    /** Se i due pattern sul Java non trovano niente, il test sopra passerebbe a vuoto. */
    @Test
    void iPatternJavaTrovanoDavveroIRedirect() throws IOException {
        String home = Files.readString(
                Path.of("src/main/java/com/fantaagent/adapter/in/web/HomeController.java"),
                StandardCharsets.UTF_8);
        assertThat(JAVA_REDIRECT.matcher(home).results()).isNotEmpty();

        String advice = Files.readString(
                Path.of("src/main/java/com/fantaagent/adapter/in/web/NoAuctionAdvice.java"),
                StandardCharsets.UTF_8);
        assertThat(JAVA_HEADER_PATH.matcher(advice).results()).isNotEmpty();
    }

    /**
     * Stesso controllo dei due sopra, ma sulla terza sede: gli script statici serviti
     * dalla radice. {@code htmx.min.js} e' escluso perche' vendorizzato — non e'
     * codice di questo progetto, e un indirizzo al suo interno non sarebbe comunque
     * un collegamento verso le pagine vecchie.
     */
    @Test
    void nessunoScriptStaticoChiamaLePagineVecchieSenzaPrefisso() throws IOException {
        List<String> fuoriPosto = new ArrayList<>();
        try (Stream<Path> files = Files.walk(Path.of("src/main/resources/static"))) {
            for (Path file : files.filter(p -> p.toString().endsWith(".js")
                    && !p.getFileName().toString().equals("htmx.min.js")).toList()) {
                collectFuoriPosto(file, Files.readString(file, StandardCharsets.UTF_8),
                        JS_CALL, fuoriPosto);
            }
        }

        assertThat(fuoriPosto)
                .describedAs("indirizzi non prefissati negli script statici: htmx non applica "
                        + "lo swap su una risposta d'errore, quindi una scorciatoia puntata alla "
                        + "vecchia URL fallisce in silenzio invece di dare un qualunque segnale")
                .isEmpty();
    }

    /** Se il pattern JS non trova niente, il test sopra passerebbe a vuoto. */
    @Test
    void ilPatternJsTrovaDavveroLeChiamate() throws IOException {
        String appJs = Files.readString(
                Path.of("src/main/resources/static/app.js"), StandardCharsets.UTF_8);
        assertThat(JS_CALL.matcher(appJs).results()).isNotEmpty();
    }
}
