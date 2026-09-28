package com.fantaagent.adapter.in.api.auth;

import com.fantaagent.adapter.in.security.AppUserPrincipal;
import com.fantaagent.application.port.out.UserAccount;
import com.fantaagent.application.service.account.AccountService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api")
public class AuthApi {

    private final AccountService accounts;
    private final AuthenticationManager authentication;
    private final SecurityContextRepository contexts;
    private final FindByIndexNameSessionRepository<? extends Session> sessions;

    public AuthApi(AccountService accounts, AuthenticationManager authentication,
                   SecurityContextRepository contexts,
                   FindByIndexNameSessionRepository<? extends Session> sessions) {
        this.accounts = accounts;
        this.authentication = authentication;
        this.contexts = contexts;
        this.sessions = sessions;
    }

    /** Non fa nulla: esiste perche' la risposta porta il cookie XSRF-TOKEN. */
    @GetMapping("/auth/csrf")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void csrf() {
    }

    @PostMapping("/auth/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthDtos.Me register(@RequestBody AuthDtos.RegisterRequest body,
                                HttpServletRequest request, HttpServletResponse response) {
        UserAccount user = accounts.register(body.email(), body.password(), body.displayName());
        signIn(user.email(), body.password(), request, response);
        return AuthDtos.Me.of(user);
    }

    @PostMapping("/auth/login")
    public AuthDtos.Me login(@RequestBody AuthDtos.LoginRequest body,
                             HttpServletRequest request, HttpServletResponse response) {
        AppUserPrincipal principal = signIn(body.email(), body.password(), request, response);
        return AuthDtos.Me.of(accounts.byId(principal.id()));
    }

    @PostMapping("/auth/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletRequest request, HttpServletResponse response) {
        new SecurityContextLogoutHandler().logout(request, response,
                SecurityContextHolder.getContext().getAuthentication());
    }

    @PostMapping("/auth/verify")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void verify(@RequestBody AuthDtos.TokenRequest body) {
        accounts.verifyEmail(body.token());
    }

    @PostMapping("/auth/password/forgot")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void forgot(@RequestBody AuthDtos.ForgotRequest body) {
        accounts.requestPasswordReset(body.email());
    }

    /**
     * Cambiare password chiude tutte le sessioni di quell'utente, compresa questa: se
     * la password e' cambiata perche' qualcuno la conosceva, quel qualcuno deve uscire.
     */
    @PostMapping("/auth/password/reset")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reset(@RequestBody AuthDtos.ResetRequest body) {
        UUID userId = accounts.resetPassword(body.token(), body.password());
        sessions.findByPrincipalName(userId.toString()).keySet().forEach(sessions::deleteById);
    }

    @GetMapping("/me")
    public AuthDtos.Me me(@AuthenticationPrincipal AppUserPrincipal me) {
        return AuthDtos.Me.of(accounts.byId(me.id()));
    }

    @PatchMapping("/me")
    public AuthDtos.Me rename(@AuthenticationPrincipal AppUserPrincipal me,
                              @RequestBody AuthDtos.RenameRequest body) {
        return AuthDtos.Me.of(accounts.rename(me.id(), body.displayName()));
    }

    @PostMapping("/me/verification")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resendVerification(@AuthenticationPrincipal AppUserPrincipal me) {
        accounts.resendVerification(me.id());
    }

    /**
     * L'accesso fatto a mano invece che dal filtro di login: la SPA manda JSON, non un
     * modulo. Un id di sessione nuovo a ogni accesso, perche' uno fissato prima da
     * qualcun altro non diventi una sessione autenticata.
     */
    private AppUserPrincipal signIn(String email, String password,
                                    HttpServletRequest request, HttpServletResponse response) {
        Authentication auth = authentication.authenticate(UsernamePasswordAuthenticationToken
                .unauthenticated(email == null ? "" : email.trim(), password == null ? "" : password));
        request.getSession(true);
        request.changeSessionId();
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);
        contexts.saveContext(context, request, response);
        return (AppUserPrincipal) auth.getPrincipal();
    }
}
