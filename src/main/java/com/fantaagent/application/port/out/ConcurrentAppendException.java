package com.fantaagent.application.port.out;

/**
 * Il numero di sequenza calcolato e' stato preso da un'altra scrittura arrivata
 * prima. Non e' un errore di chi scrive: e' il segnale di rileggere il registro e
 * rifare i controlli, perche' il comando potrebbe non essere piu' valido.
 */
public class ConcurrentAppendException extends RuntimeException {

    private final long seq;

    public ConcurrentAppendException(long seq, Throwable cause) {
        super("il numero " + seq + " e' gia' stato scritto da un'altra richiesta", cause);
        this.seq = seq;
    }

    public long seq() {
        return seq;
    }
}
