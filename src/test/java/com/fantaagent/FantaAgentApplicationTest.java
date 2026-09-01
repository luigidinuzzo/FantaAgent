package com.fantaagent;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("dev")
class FantaAgentApplicationTest {

    @Test
    void contextLoads() {
        // Se il contesto non si avvia, il test fallisce.
    }
}
