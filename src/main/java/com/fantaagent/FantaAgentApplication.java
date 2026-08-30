package com.fantaagent;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class FantaAgentApplication {

    public static void main(String[] args) {
        SpringApplication.run(FantaAgentApplication.class, args);
    }
}
