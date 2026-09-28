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
                                           SecurityContextRepository contexts) throws Exception {
        ProblemResponses problems = new ProblemResponses(json);
        http
                .csrf(csrf -> csrf
                        .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                        .csrfTokenRequestHandler(new SpaCsrfTokenRequestHandler()))
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
