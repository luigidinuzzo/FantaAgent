package com.fantaagent.architecture;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

import java.util.Arrays;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
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

    /**
     * La pagina proiettata sullo schermo condiviso non deve poter mostrare il
     * prezzo consigliato. Non basta che l'interfaccia non lo disegni: basta che
     * l'endpoint lo restituisca, e chiunque apra la scheda di rete del browser —
     * o punti un telefono sulla stessa URL — lo legge.
     *
     * <p>Con Thymeleaf la garanzia era che PublicBidder non avesse il campo. Qui
     * e' che il package del tabellone non possa nemmeno nominare i tipi da cui un
     * prezzo consigliato proviene. Chi fa fallire questo test sta per proiettare
     * i propri tetti sullo schermo che guardano tutti gli avversari.
     *
     * <p>Dove si ferma: questa regola vede solo i riferimenti diretti a un tipo
     * di {@code domain.strategy}. Se AuctionService calcolasse un giorno un
     * PriceRecommendation al suo interno e restituisse solo l'int che ne esce, il
     * tabellone potrebbe metterlo in un campo senza nominare mai il tipo
     * proibito, e questo test non se ne accorgerebbe.
     */
    @Test
    void boardApiCannotReachValuation() {
        noClasses().that().resideInAPackage("com.fantaagent.adapter.in.api.board..")
                .should().dependOnClassesThat().resideInAnyPackage(
                        "com.fantaagent.domain.strategy..")
                .because("il tabellone e' proiettato: non puo' contenere valutazioni")
                .allowEmptyShould(true)
                .check(classes);
    }

    /**
     * Il Task 14 ha aggiunto {@code @RequestMapping("/legacy")} a mano ai cinque
     * controller delle pagine vecchie. Questo test e' la versione strutturale di
     * quel lavoro a mano: un sesto controller in questo package, dimenticato il
     * prefisso, mapperebbe le sue rotte direttamente sugli indirizzi della SPA — e
     * nessun test se ne accorgerebbe, perche' finora nessuno lo verificava.
     */
    @Test
    void ogniControllerDellePagineVecchiePortaIlPrefissoLegacy() {
        classes().that().resideInAPackage("com.fantaagent.adapter.in.web")
                .and().areAnnotatedWith(Controller.class)
                .should(portareIlPrefissoLegacy())
                .check(classes);
    }

    private static ArchCondition<JavaClass> portareIlPrefissoLegacy() {
        return new ArchCondition<>("essere annotate con @RequestMapping(\"/legacy\")") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                boolean ok = item.isAnnotatedWith(RequestMapping.class)
                        && Arrays.equals(
                                item.getAnnotationOfType(RequestMapping.class).value(),
                                new String[]{"/legacy"});
                String message = ok
                        ? item.getName() + " porta @RequestMapping(\"/legacy\")"
                        : item.getName() + " NON porta @RequestMapping(\"/legacy\") a livello di classe";
                events.add(new SimpleConditionEvent(item, ok, message));
            }
        };
    }
}
