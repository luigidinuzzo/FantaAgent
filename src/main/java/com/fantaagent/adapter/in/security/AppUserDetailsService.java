package com.fantaagent.adapter.in.security;

import com.fantaagent.application.port.out.UserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

/** Si entra con l'email; dentro la sessione si resta con l'id. */
public class AppUserDetailsService implements UserDetailsService {

    private final UserRepository users;

    public AppUserDetailsService(UserRepository users) {
        this.users = users;
    }

    @Override
    public UserDetails loadUserByUsername(String email) {
        return users.byEmail(email)
                .map(u -> new AppUserPrincipal(u.id(), u.email(), u.displayName(), u.passwordHash()))
                .orElseThrow(() -> new UsernameNotFoundException("nessun account"));
    }
}
