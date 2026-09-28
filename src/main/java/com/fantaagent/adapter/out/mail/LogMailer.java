package com.fantaagent.adapter.out.mail;

import com.fantaagent.application.port.out.Mailer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * In locale non c'e' un server di posta: il messaggio va nel log, link compreso, e da
 * li' lo si apre a mano. In produzione c'e' {@link SmtpMailer}.
 */
public class LogMailer implements Mailer {

    private static final Logger LOG = LoggerFactory.getLogger(LogMailer.class);

    @Override
    public void send(String to, String subject, String body) {
        LOG.info("email per {} — {}\n{}", to, subject, body);
    }
}
