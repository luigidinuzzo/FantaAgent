package com.fantaagent.domain.strategy;

/**
 * Fattore che ha determinato la raccomandazione, con il suo contributo numerico.
 * I driver sono anche il materiale che la fase 7 passerà a Claude: il modello li
 * interpreta, non li ricalcola.
 */
public record Driver(String label, double contribution, String explanation) {
}
