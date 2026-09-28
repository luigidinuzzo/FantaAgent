package com.fantaagent.application.port.out;

/** La richiesta con questa chiave di idempotenza e' gia' nel registro. */
public class DuplicateRequestException extends RuntimeException {

    private final String requestId;

    public DuplicateRequestException(String requestId) {
        super("richiesta gia' registrata: " + requestId);
        this.requestId = requestId;
    }

    public String requestId() {
        return requestId;
    }
}
