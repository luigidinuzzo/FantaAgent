package com.fantaagent.adapter.in.api.auth;

import com.fantaagent.application.port.out.Mailer;
import com.fantaagent.testsupport.ApiFixture;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.web.context.WebApplicationContext;

import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("dev")
class AuthApiTest {

    private static final String PROBLEMS = "https://fantaagent.local/problems/";

    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private Mailer mailer;

    private MockMvc mvc;
    private String email;

    /**
     * Il contesto Spring, e con lui il database e il contatore dei tentativi, e'
     * condiviso fra i test della classe: ognuno usa un'email sua, e chi sbaglia la
     * password lo fa da un indirizzo suo.
     */
    @BeforeEach
    void setUp() {
        mvc = ApiFixture.mvc(context);
        email = "anna+" + UUID.randomUUID() + "@example.com";
    }

    static RequestPostProcessor from(String address) {
        return request -> {
            request.setRemoteAddr(address);
            return request;
        };
    }

    private String lastToken() {
        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(mailer, atLeastOnce()).send(anyString(), anyString(), body.capture());
        Matcher m = Pattern.compile("token=([A-Za-z0-9_-]+)").matcher(body.getValue());
        if (!m.find()) {
            throw new AssertionError("nessun token nell'email");
        }
        return m.group(1);
    }

    @Test
    void registrarsiApreGiaLaSessione() throws Exception {
        Cookie session = ApiFixture.register(mvc, email, "Anna");
        mvc.perform(get("/api/me").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.displayName").value("Anna"))
                .andExpect(jsonPath("$.emailVerified").value(false))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
    }

    @Test
    void senzaAccessoLApiRisponde401ConUnProblema() throws Exception {
        mvc.perform(get("/api/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "unauthenticated"));
        mvc.perform(get("/api/leagues/default/auctions/corrente/state"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void laPasswordSbagliataEUnProblemaDetto() throws Exception {
        ApiFixture.register(mvc, email, "Anna");
        mvc.perform(post("/api/auth/login").with(csrf()).with(from("10.0.0.1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"sbagliata!!\"}".formatted(email)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "bad-credentials"))
                .andExpect(jsonPath("$.detail").value("Email o password non corretti."));
    }

    @Test
    void unaScritturaSenzaTokenCsrfERifiutata() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"a@b.it\",\"password\":\"x\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "forbidden"));
    }

    @Test
    void ilTokenCsrfArrivaComeCookieLeggibile() throws Exception {
        mvc.perform(get("/api/auth/csrf"))
                .andExpect(status().isNoContent())
                .andExpect(result -> {
                    Cookie xsrf = result.getResponse().getCookie("XSRF-TOKEN");
                    if (xsrf == null || xsrf.isHttpOnly()) {
                        throw new AssertionError("serve un cookie XSRF-TOKEN leggibile dal client");
                    }
                });
    }

    @Test
    void registrazioneConDatiSbagliatiDiceIlCampo() throws Exception {
        mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"no\",\"password\":\"corta\",\"displayName\":\"\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "invalid-account"))
                .andExpect(jsonPath("$.errors.email").isArray())
                .andExpect(jsonPath("$.errors.password").isArray())
                .andExpect(jsonPath("$.errors.displayName").isArray());
    }

    @Test
    void unaSecondaRegistrazioneConLaStessaEmailEUnConflitto() throws Exception {
        ApiFixture.register(mvc, email, "Anna");
        mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"%s\",\"displayName\":\"Anna\"}"
                                .formatted(email.toUpperCase(), ApiFixture.PASSWORD)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "email-taken"));
    }

    @Test
    void uscireChiudeLaSessione() throws Exception {
        Cookie session = ApiFixture.register(mvc, email, "Anna");
        mvc.perform(post("/api/auth/logout").with(csrf()).cookie(session))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/me").cookie(session)).andExpect(status().isUnauthorized());
    }

    @Test
    void laNuovaPasswordChiudeLeSessioniAperte() throws Exception {
        Cookie session = ApiFixture.register(mvc, email, "Anna");
        mvc.perform(post("/api/auth/verify").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"%s\"}".formatted(lastToken())))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/auth/password/forgot").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\"}".formatted(email)))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/auth/password/reset").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"%s\",\"password\":\"un'altra password lunga\"}".formatted(lastToken())))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/me").cookie(session)).andExpect(status().isUnauthorized());
    }

    @Test
    void unLinkNonValidoEDettoCosi() throws Exception {
        mvc.perform(post("/api/auth/verify").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"inventato\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value(PROBLEMS + "invalid-token"));
    }

    @Test
    void ilNomeSiCambiaDalProfilo() throws Exception {
        Cookie session = ApiFixture.register(mvc, email, "Anna");
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/api/me")
                        .with(csrf()).cookie(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"Anna B.\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Anna B."));
    }

    @Test
    void laSaluteDellAppRestaPubblica() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
    }
}
