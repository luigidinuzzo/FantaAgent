package com.fantaagent.application.port.out;

public class InitialTakenException extends RuntimeException {

    public InitialTakenException(char initial) {
        super("L'iniziale " + initial + " è già di un altro membro: scegline un'altra.");
    }
}
