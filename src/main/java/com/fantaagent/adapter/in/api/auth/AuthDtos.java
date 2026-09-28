package com.fantaagent.adapter.in.api.auth;

import com.fantaagent.application.port.out.UserAccount;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(String email, String password, String displayName) {
    }

    public record LoginRequest(String email, String password) {
    }

    public record TokenRequest(String token) {
    }

    public record ForgotRequest(String email) {
    }

    public record ResetRequest(String token, String password) {
    }

    public record RenameRequest(String displayName) {
    }

    /** Chi sono io. Niente hash, niente date: solo cio' che una schermata mostra. */
    public record Me(String id, String email, String displayName, boolean emailVerified) {

        public static Me of(UserAccount u) {
            return new Me(u.id().toString(), u.email(), u.displayName(), u.emailVerified());
        }
    }
}
