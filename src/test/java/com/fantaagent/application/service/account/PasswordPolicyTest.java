package com.fantaagent.application.service.account;

import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class PasswordPolicyTest {

    private final PasswordPolicy policy = new PasswordPolicy(Set.of("qwertyuiop"));

    @Test
    void dieciCaratteriBastanoSenzaRegoleDiComposizione() {
        assertThat(policy.problems("tuttominuscolo")).isEmpty();
    }

    @Test
    void troppoCorta() {
        assertThat(policy.problems("corta")).containsExactly("La password deve avere almeno 10 caratteri.");
    }

    @Test
    void troppoComuneAncheConLeMaiuscole() {
        assertThat(policy.problems("QwertyUiop"))
                .containsExactly("Questa password è fra le più usate: scegline un'altra.");
    }

    @Test
    void laListaVeraSiCaricaDalClasspath() {
        assertThat(PasswordPolicy.fromClasspath().problems("1234567890")).isNotEmpty();
    }
}
