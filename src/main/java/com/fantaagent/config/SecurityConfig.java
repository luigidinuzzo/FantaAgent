package com.fantaagent.config;

import com.fantaagent.adapter.in.security.AppUserDetailsService;
import com.fantaagent.adapter.in.security.ProblemResponses;
import com.fantaagent.adapter.in.security.SpaCsrfTokenRequestHandler;
import com.fantaagent.application.port.out.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRepository;

/**
 * Chi puo' chiamare cosa, a grana grossa: pubbliche le rotte per entrare e la lettura
 * di un invito, autenticato il resto di {@code /api}, libera la SPA (e' una pagina
 * statica: i dati li protegge l'API). Membro e amministratore si decidono piu' in
 * la', per lega, da {@code ApiAccess}.
 */
@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, ObjectMapper json,
                                           SecurityContextRepository contexts,
                                           CsrfTokenRepository csrfTokens) throws Exception {
        ProblemResponses problems = new ProblemResponses(json);
        http
                .csrf(csrf -> csrf
                        .csrfTokenRepository(csrfTokens)
                        .csrfTokenRequestHandler(new SpaCsrfTokenRequestHandler())
                        // /legacy non ha login ne' lega (e' abbandonato, e dal Task 15
                        // esiste solo sotto il profilo locale): i suoi moduli htmx
                        // mandano hx-post senza alcun token, e non lo aggiungeremo mai.
                        .ignoringRequestMatchers("/legacy/**"))
                .securityContext(sc -> sc.securityContextRepository(contexts))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.GET, "/api/auth/csrf").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login",
                                "/api/auth/verify", "/api/auth/password/forgot",
                                "/api/auth/password/reset").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/invites/*").permitAll()
                        .requestMatchers("/api/**").authenticated()
                        .requestMatchers("/actuator/health").permitAll()
                        .requestMatchers("/actuator/**").denyAll()
                        .anyRequest().permitAll())
                .exceptionHandling(e -> e
                        .authenticationEntryPoint(problems)
                        .accessDeniedHandler(problems))
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .requestCache(AbstractHttpConfigurer::disable);
        return http.build();
    }

    @Bean
    public SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    /**
     * Bean, non un'espressione inline nel filtro: {@code ApiFixture}, nei test,
     * ripristina questo repository dal contesto dopo che {@code .with(csrf())} di
     * spring-security-test lo sostituisce (per riflessione, sul filtro condiviso) —
     * gli serve un bean da cui recuperarlo, non uno stato salvato a mano.
     */
    @Bean
    public CsrfTokenRepository csrfTokenRepository() {
        return CookieCsrfTokenRepository.withHttpOnlyFalse();
    }

    @Bean
    public AppUserDetailsService appUserDetailsService(UserRepository users) {
        return new AppUserDetailsService(users);
    }

    @Bean
    public AuthenticationManager authenticationManager(AppUserDetailsService users,
                                                       PasswordEncoder encoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(users);
        provider.setPasswordEncoder(encoder);
        return new ProviderManager(provider);
    }
}
