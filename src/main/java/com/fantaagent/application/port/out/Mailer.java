package com.fantaagent.application.port.out;

public interface Mailer {

    void send(String to, String subject, String body);
}
