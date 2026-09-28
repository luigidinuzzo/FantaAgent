package com.fantaagent.testsupport;

import jakarta.servlet.http.Cookie;
import org.springframework.http.MediaType;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.session.web.http.SessionRepositoryFilter;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.Map;
import java.util.WeakHashMap;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * MockMvc come lo vede il browser: il filtro delle sessioni JDBC PRIMA della catena di
 * sicurezza, e la sessione portata dal cookie SESSION da una richiesta all'altra.
 *
 * <p>Senza {@link SessionRepositoryFilter}, MockMvc userebbe le sue sessioni in
 * memoria e un test sulla chiusura delle sessioni passerebbe senza aver chiuso niente.
 */
public final class ApiFixture {

    public static final String PASSWORD = "una password lunga";

    /**
     * Il post-processor {@code csrf()} di spring-security-test, alla prima chiamata in
     * un contesto Spring condiviso, sostituisce per riflessione — e per sempre, sul
     * bean singleton del filtro — il {@code CsrfTokenRepository} con uno che non
     * scrive piu' il cookie {@code XSRF-TOKEN} (lo tiene in sessione). Il contesto e'
     * condiviso da tutti i test della classe: senza questo ripristino, un test che non
     * chiama {@code csrf()} vedrebbe o no il cookie a seconda di quali test sono girati
     * prima di lui. Si salva il repository originale alla prima richiesta e lo si
     * rimette ogni volta, cosi' l'ordine di esecuzione non conta piu'.
     */
    private static final Map<WebApplicationContext, CsrfTokenRepository> ORIGINAL_CSRF_REPOSITORY =
            new WeakHashMap<>();

    private ApiFixture() {
    }

    public static MockMvc mvc(WebApplicationContext context) {
        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context)
                .addFilters(context.getBean(SessionRepositoryFilter.class))
                .apply(springSecurity())
                .build();
        restoreCsrfTokenRepository(context);
        return mvc;
    }

    private static void restoreCsrfTokenRepository(WebApplicationContext context) {
        CsrfFilter csrfFilter = findCsrfFilter(context);
        if (csrfFilter == null) {
            return;
        }
        CsrfTokenRepository original = ORIGINAL_CSRF_REPOSITORY.computeIfAbsent(context,
                c -> (CsrfTokenRepository) ReflectionTestUtils.getField(csrfFilter, "tokenRepository"));
        ReflectionTestUtils.setField(csrfFilter, "tokenRepository", original);
    }

    private static CsrfFilter findCsrfFilter(WebApplicationContext context) {
        FilterChainProxy proxy = context.getBean(FilterChainProxy.class);
        for (SecurityFilterChain chain : proxy.getFilterChains()) {
            for (var filter : chain.getFilters()) {
                if (filter instanceof CsrfFilter csrfFilter) {
                    return csrfFilter;
                }
            }
        }
        return null;
    }

    public static Cookie register(MockMvc mvc, String email, String name) throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/register").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s","displayName":"%s"}""".formatted(email, PASSWORD, name)))
                .andExpect(status().isCreated())
                .andReturn();
        return session(result);
    }

    public static Cookie login(MockMvc mvc, String email) throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/login").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s"}""".formatted(email, PASSWORD)))
                .andExpect(status().isOk())
                .andReturn();
        return session(result);
    }

    /** Un'email mai usata: il database e' condiviso da tutti i test dello stesso contesto. */
    public static String uniqueEmail(String name) {
        return name + "+" + java.util.UUID.randomUUID() + "@example.com";
    }

    public static Cookie session(MvcResult result) {
        Cookie cookie = result.getResponse().getCookie("SESSION");
        if (cookie == null) {
            throw new AssertionError("nessun cookie SESSION nella risposta");
        }
        return cookie;
    }
}
