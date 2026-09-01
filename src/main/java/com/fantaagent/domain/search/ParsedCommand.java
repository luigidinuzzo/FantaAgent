package com.fantaagent.domain.search;

import java.util.Optional;
import java.util.OptionalInt;

public record ParsedCommand(String term, OptionalInt price, Optional<Character> participantInitial) {

    public boolean isPurchase() {
        return price.isPresent() && !term.isBlank();
    }
}
