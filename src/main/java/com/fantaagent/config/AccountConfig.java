package com.fantaagent.config;

import com.fantaagent.adapter.out.jdbc.JdbcUserRepository;
import com.fantaagent.adapter.out.jdbc.JdbcUserTokenRepository;
import com.fantaagent.adapter.out.mail.LogMailer;
import com.fantaagent.adapter.out.mail.SmtpMailer;
import com.fantaagent.adapter.out.security.SpringPasswordHasher;
import com.fantaagent.application.port.out.Mailer;
import com.fantaagent.application.port.out.PasswordHasher;
import com.fantaagent.application.port.out.UserRepository;
import com.fantaagent.application.port.out.UserTokenRepository;
import com.fantaagent.application.service.account.AccountService;
import com.fantaagent.application.service.account.LoginThrottle;
import com.fantaagent.application.service.account.PasswordPolicy;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Clock;

@Configuration
public class AccountConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }

    @Bean
    public LoginThrottle loginThrottle(Clock clock) {
        return new LoginThrottle(clock);
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return SpringPasswordHasher.argon2Default();
    }

    @Bean
    public PasswordHasher passwordHasher(PasswordEncoder encoder) {
        return new SpringPasswordHasher(encoder);
    }

    @Bean
    public UserRepository userRepository(JdbcClient jdbc) {
        return new JdbcUserRepository(jdbc);
    }

    @Bean
    public UserTokenRepository userTokenRepository(JdbcClient jdbc) {
        return new JdbcUserTokenRepository(jdbc);
    }

    /**
     * SMTP solo se l'ambiente ne indica uno: {@code JavaMailSender} esiste solo con
     * {@code spring.mail.host}, e senza di lui le email vanno nel log.
     */
    @Bean
    public Mailer mailer(ObjectProvider<JavaMailSender> sender,
                         @Value("${spring.mail.host:}") String host,
                         @Value("${fantaagent.mail-from}") String from) {
        return host.isBlank() ? new LogMailer() : new SmtpMailer(sender.getObject(), from);
    }

    @Bean
    public AccountService accountService(UserRepository users, UserTokenRepository tokens,
                                         PasswordHasher hasher, Mailer mailer, Clock clock,
                                         @Value("${fantaagent.public-url}") String publicUrl) {
        return new AccountService(users, tokens, hasher, PasswordPolicy.fromClasspath(), mailer,
                clock, publicUrl);
    }
}
