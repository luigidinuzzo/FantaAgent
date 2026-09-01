package com.fantaagent.architecture;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static org.assertj.core.api.Assertions.assertThat;

class ArchitectureTest {

    private static JavaClasses classes;

    @BeforeAll
    static void importClasses() {
        classes = new ClassFileImporter()
                .withImportOption(new ImportOption.DoNotIncludeTests())
                .importPackages("com.fantaagent");
    }

    /**
     * Guard test: fails if ArchUnit ever again becomes unable to read this project's
     * bytecode (e.g. a future JDK bump outpaces the ASM version bundled in ArchUnit).
     *
     * All three boundary rules below use {@code allowEmptyShould(true)} because the
     * domain and application packages currently contain no classes with dependencies
     * to check. That flag makes an empty import silently "pass" — which is exactly
     * what happened before: ArchUnit 1.3.0's bundled ASM could not parse Java 25
     * class files (major version 69), importPackages() returned an empty set, and
     * every rule reported success while checking nothing. Do not remove this test;
     * it is what makes allowEmptyShould(true) above safe to keep.
     */
    @Test
    void importedClassesAreNotEmptyAndIncludeKnownProductionClass() {
        assertThat(classes).isNotEmpty();
        assertThat(classes.contain("com.fantaagent.FantaAgentApplication")).isTrue();
    }

    @Test
    void domainDoesNotDependOnFrameworks() {
        noClasses().that().resideInAPackage("com.fantaagent.domain..")
                .should().dependOnClassesThat().resideInAnyPackage(
                        "org.springframework..",
                        "com.fasterxml..",
                        "org.apache.poi..",
                        "org.apache.commons..",
                        "jakarta..")
                .because("il dominio deve restare testabile senza framework")
                .allowEmptyShould(true)
                .check(classes);
    }

    @Test
    void domainDoesNotDependOnApplicationOrAdapter() {
        noClasses().that().resideInAPackage("com.fantaagent.domain..")
                .should().dependOnClassesThat().resideInAnyPackage(
                        "com.fantaagent.application..",
                        "com.fantaagent.adapter..",
                        "com.fantaagent.config..",
                        "com.fantaagent.ingestion..")
                .because("il dominio è il livello più interno")
                .allowEmptyShould(true)
                .check(classes);
    }

    @Test
    void applicationDoesNotDependOnAdapter() {
        noClasses().that().resideInAPackage("com.fantaagent.application..")
                .should().dependOnClassesThat().resideInAnyPackage(
                        "com.fantaagent.adapter..")
                .because("l'applicazione dipende dalle porte, non dalle implementazioni")
                .allowEmptyShould(true)
                .check(classes);
    }
}
