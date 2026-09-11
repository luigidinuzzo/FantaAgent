package com.fantaagent.adapter.in.api;

import java.util.List;
import java.util.Map;

/**
 * Le impostazioni rifiutate, con gli errori raggruppati per campo (task 16: prima
 * erano quattro sezioni fisse, ora sono le chiavi che {@code validateByField}
 * restituisce, unite da {@code SettingsApi}).
 *
 * <p>Porta la mappa intera e non il primo errore: i validatori restituiscono l'elenco
 * completo per una ragione — riportarne uno per volta costringerebbe a tre giri per
 * scoprire tre problemi visibili tutti dall'inizio — e troncarla qui butterebbe via
 * proprio cio' che quei validatori esistono per dare.
 */
public class InvalidSettingsException extends RuntimeException {

    private final Map<String, List<String>> errors;

    public InvalidSettingsException(Map<String, List<String>> errors) {
        super("impostazioni non valide");
        this.errors = Map.copyOf(errors);
    }

    public Map<String, List<String>> errors() {
        return errors;
    }
}
