package com.fantaagent.application.service.league;

public class AdminOnlyException extends RuntimeException {

    public AdminOnlyException() {
        super("Solo l'amministratore della lega può farlo.");
    }
}
