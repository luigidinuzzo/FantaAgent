package com.fantaagent.application.port.out;

/** L'algoritmo delle password sta fuori dall'applicazione: qui solo cosa serve. */
public interface PasswordHasher {

    String hash(String raw);

    boolean matches(String raw, String hash);
}
