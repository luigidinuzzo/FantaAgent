package com.fantaagent.architecture;

import org.junit.jupiter.api.Test;
import org.w3c.dom.Document;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.xpath.XPath;
import javax.xml.xpath.XPathConstants;
import javax.xml.xpath.XPathFactory;

import java.io.File;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La build del frontend deve stare in un profilo, non nel ciclo di vita di
 * default. Senza questo vincolo ogni {@code mvn test} pagherebbe una build npm,
 * e chi lavora sul backend smetterebbe di eseguire i test.
 *
 * <p>Il pom viene letto come XML, non confrontato come testo: un controllo
 * testuale sulla posizione delle sottostringhe non distingue "appare dopo"
 * da "e' annidato dentro", e non protegge dalla regressione che questo test
 * esiste per bloccare — il plugin del frontend che finisce nel ciclo di vita
 * di default. Il parser e' configurato senza namespace awareness: il pom
 * dichiara un default namespace (xmlns="http://maven.apache.org/POM/4.0.0"),
 * e un XPath ingenuo come /project/build non troverebbe nulla se il parser
 * lo rispettasse; disattivarlo evita di dover scrivere ogni passo con
 * local-name().
 */
class BuildProfileTest {

    @Test
    void frontendBuildIsConfinedToTheProdProfile() throws Exception {
        Document pom = parsePom();
        XPath xPath = XPathFactory.newInstance().newXPath();

        double inProdProfile = (double) xPath.evaluate(
                "count(/project/profiles/profile[id='prod']/build/plugins/plugin"
                        + "[artifactId='frontend-maven-plugin'])",
                pom, XPathConstants.NUMBER);
        assertThat(inProdProfile)
                .as("il plugin del frontend deve stare nel profilo prod")
                .isEqualTo(1.0);

        double inDefaultBuild = (double) xPath.evaluate(
                "count(/project/build/plugins/plugin[artifactId='frontend-maven-plugin'])",
                pom, XPathConstants.NUMBER);
        assertThat(inDefaultBuild)
                .as("il plugin del frontend non deve stare nel build di default,"
                        + " altrimenti mvn test pagherebbe una build npm")
                .isEqualTo(0.0);
    }

    private static Document parsePom() throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(false);
        DocumentBuilder builder = factory.newDocumentBuilder();
        return builder.parse(new File("pom.xml"));
    }
}
