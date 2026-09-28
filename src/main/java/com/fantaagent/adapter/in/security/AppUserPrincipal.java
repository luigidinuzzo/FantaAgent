package com.fantaagent.adapter.in.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Chi ha fatto l'accesso. Il nome e' l'id, non l'email: e' la chiave con cui Spring
 * Session indicizza le sessioni, e deve restare la stessa anche se un giorno l'email
 * cambia.
 *
 * <p>Nessun ruolo globale: essere amministratore e' una proprieta' della lega, non
 * della persona, e la decide {@code LeagueService} lega per lega.
 */
public record AppUserPrincipal(UUID id, String email, String displayName, String passwordHash)
        implements UserDetails {

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of();
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return id.toString();
    }
}
