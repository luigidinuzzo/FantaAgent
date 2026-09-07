package com.fantaagent.adapter.in.api;

public class NothingToUndoException extends RuntimeException {

    public NothingToUndoException() {
        super("Non c'è nessun acquisto da annullare.");
    }
}
