package com.fantaagent.architecture;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

class ArchitectureTest {

    private static JavaClasses classes;

    @BeforeAll
    static void importClasses() {
        classes = new ClassFileImporter()
                .withImportOption(new ImportOption.DoNotIncludeTests())
                .importPackages("com.fantaagent");
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
