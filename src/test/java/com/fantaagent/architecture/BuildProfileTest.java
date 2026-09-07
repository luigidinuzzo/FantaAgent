package com.fantaagent.architecture;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La build del frontend deve stare in un profilo, non nel ciclo di vita di
 * default. Senza questo vincolo ogni {@code mvn test} pagherebbe una build npm,
 * e chi lavora sul backend smetterebbe di eseguire i test.
 */
class BuildProfileTest {

    @Test
    void frontendBuildIsConfinedToTheProdProfile() throws Exception {
        String pom = Files.readString(Path.of("pom.xml"));

        assertThat(pom)
                .as("il plugin del frontend deve esistere")
                .contains("frontend-maven-plugin");

        int profilesStart = pom.indexOf("<profiles>");
        assertThat(profilesStart)
                .as("il pom deve dichiarare dei profili")
                .isGreaterThan(-1);
        assertThat(pom.indexOf("frontend-maven-plugin"))
                .as("il plugin del frontend deve stare dentro <profiles>")
                .isGreaterThan(profilesStart);
    }
}
