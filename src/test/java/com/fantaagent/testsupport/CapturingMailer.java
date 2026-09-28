package com.fantaagent.testsupport;

import com.fantaagent.application.port.out.Mailer;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Le email che l'app avrebbe mandato, per leggerne i link. */
public final class CapturingMailer implements Mailer {

    public record Sent(String to, String subject, String body) {
    }

    private static final Pattern TOKEN = Pattern.compile("token=([A-Za-z0-9_-]+)");

    private final List<Sent> sent = new ArrayList<>();

    @Override
    public synchronized void send(String to, String subject, String body) {
        sent.add(new Sent(to, subject, body));
    }

    public synchronized List<Sent> sent() {
        return List.copyOf(sent);
    }

    /** Il token dell'ultimo link spedito. */
    public synchronized String lastToken() {
        Matcher m = TOKEN.matcher(sent.getLast().body());
        if (!m.find()) {
            throw new AssertionError("nessun link con token nell'ultima email");
        }
        return m.group(1);
    }
}
