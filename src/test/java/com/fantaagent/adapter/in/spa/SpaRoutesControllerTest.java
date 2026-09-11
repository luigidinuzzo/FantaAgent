package com.fantaagent.adapter.in.spa;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class SpaRoutesControllerTest {

    @Autowired
    private MockMvc mvc;

    /**
     * Si verifica l'INOLTRO, non la pagina: nel profilo di sviluppo
     * {@code static/index.html} non esiste — lo copia il profilo prod — e MockMvc
     * registra il forward senza eseguirlo.
     */
    @Test
    void laRadiceInoltraAllaSpa() throws Exception {
        mvc.perform(get("/"))
                .andExpect(status().isOk())
                .andExpect(forwardedUrl("/index.html"));
    }

    @Test
    void unaRottaProfondaRicaricataInoltraAllaSpa() throws Exception {
        mvc.perform(get("/riepilogo"))
                .andExpect(status().isOk())
                .andExpect(forwardedUrl("/index.html"));
    }

    /**
     * Il vincolo vero. Un frontend che riceve index.html al posto di un errore JSON
     * mostra una pagina bianca e nessun messaggio.
     */
    @Test
    void unApiInesistenteRestaUn404InProblemJson() throws Exception {
        mvc.perform(get("/api/leagues/default/auctions/corrente/inventato"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.type")
                        .value("https://fantaagent.local/problems/unknown-endpoint"));
    }

    /**
     * Le pagine vecchie non sono toccate dall'elenco della SPA: rispondono ancora,
     * e come pagine HTML rese da Thymeleaf, non come inoltri a index.html.
     */
    @Test
    void lePagineVecchieRestanoHtml() throws Exception {
        mvc.perform(get("/legacy"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML));
    }

    @Test
    void unIndirizzoInventatoResta404InvecheDiUnaPaginaBianca() throws Exception {
        mvc.perform(get("/inventato")).andExpect(status().isNotFound());
    }

    /**
     * L'elenco del server e quello del router React non possono divergere in silenzio:
     * una rotta aggiunta di la' e dimenticata di qua darebbe 404 solo dopo un
     * ricaricamento, cioe' nel momento in cui nessuno sta guardando.
     */
    @Test
    void leRotteDelServerCoincidonoConQuelleDelRouterReact() throws IOException {
        String router = Files.readString(
                Path.of("frontend/src/router.tsx"), StandardCharsets.UTF_8);
        Matcher m = Pattern.compile("path:\\s*'([^']+)'").matcher(router);
        Set<String> client = new LinkedHashSet<>();
        while (m.find()) {
            client.add(m.group(1));
        }

        assertThat(client)
                .describedAs("rotte dichiarate in router.tsx")
                .isNotEmpty()
                .containsExactlyInAnyOrderElementsOf(SpaRoutesController.ROUTES);
    }

    /**
     * Le rotte sono scritte due volte nel controller — nella costante {@code ROUTES}
     * e nell'annotazione {@code @GetMapping}, che vuole costanti di compilazione e non
     * accetta una {@code List} — cosi' il test sopra, che confronta {@code ROUTES}
     * con {@code router.tsx}, verificherebbe una lista che il routing non usa davvero
     * se le due copie divergessero. Questo test legge l'annotazione via reflection e
     * la confronta con {@code ROUTES}, cosa che il compilatore da solo non garantisce:
     * le costanti condivise impediscono che il VALORE di una rotta diverga, non che
     * qualcuno ne aggiunga una a un elenco scordandosi dell'altro.
     */
    @Test
    void laMappaturaHttpUsaEsattamenteLeStesseRotteDiRoutes() throws NoSuchMethodException {
        GetMapping mapping = SpaRoutesController.class.getMethod("spa").getAnnotation(GetMapping.class);

        assertThat(mapping.value()).containsExactlyInAnyOrderElementsOf(SpaRoutesController.ROUTES);
    }
}
