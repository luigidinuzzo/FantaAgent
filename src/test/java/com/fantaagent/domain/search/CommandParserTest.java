package com.fantaagent.domain.search;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CommandParserTest {

    @Test
    void aBareTermIsJustASearch() {
        ParsedCommand parsed = CommandParser.parse("bast");

        assertThat(parsed.term()).isEqualTo("bast");
        assertThat(parsed.price()).isEmpty();
        assertThat(parsed.participantInitial()).isEmpty();
        assertThat(parsed.isPurchase()).isFalse();
    }

    @Test
    void aTrailingNumberIsAPurchaseByMe() {
        ParsedCommand parsed = CommandParser.parse("bast 47");

        assertThat(parsed.term()).isEqualTo("bast");
        assertThat(parsed.price()).hasValue(47);
        assertThat(parsed.participantInitial()).isEmpty();
        assertThat(parsed.isPurchase()).isTrue();
    }

    @Test
    void aTrailingLetterAfterAPriceIsTheBuyer() {
        ParsedCommand parsed = CommandParser.parse("bast 47 m");

        assertThat(parsed.term()).isEqualTo("bast");
        assertThat(parsed.price()).hasValue(47);
        assertThat(parsed.participantInitial()).hasValue('M');
    }

    @Test
    void multiWordNamesAreKeptTogether() {
        ParsedCommand parsed = CommandParser.parse("de rossi 12 l");

        assertThat(parsed.term()).isEqualTo("de rossi");
        assertThat(parsed.price()).hasValue(12);
        assertThat(parsed.participantInitial()).hasValue('L');
    }

    @Test
    void aTrailingLetterWithoutAPriceStaysPartOfTheName() {
        // "Thuram M." è un nome del listone, non un acquisto da parte di M.
        ParsedCommand parsed = CommandParser.parse("thuram m");

        assertThat(parsed.term()).isEqualTo("thuram m");
        assertThat(parsed.price()).isEmpty();
        assertThat(parsed.participantInitial()).isEmpty();
    }

    @Test
    void collapsesExtraWhitespace() {
        ParsedCommand parsed = CommandParser.parse("   bast    47   m  ");

        assertThat(parsed.term()).isEqualTo("bast");
        assertThat(parsed.price()).hasValue(47);
        assertThat(parsed.participantInitial()).hasValue('M');
    }

    @Test
    void anEmptyCommandParsesToAnEmptyTerm() {
        ParsedCommand parsed = CommandParser.parse("   ");

        assertThat(parsed.term()).isEmpty();
        assertThat(parsed.isPurchase()).isFalse();
    }

    @Test
    void rejectsANonPositivePriceByTreatingItAsPartOfTheName() {
        ParsedCommand parsed = CommandParser.parse("bast 0");

        assertThat(parsed.term()).isEqualTo("bast 0");
        assertThat(parsed.price()).isEmpty();
    }
}
