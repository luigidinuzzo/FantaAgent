package com.fantaagent.adapter.in.api;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@link AuctionsApi#select} converte QUALUNQUE {@code IllegalArgumentException} da
 * {@code AuctionRuntime#select} in questa eccezione — non solo quella per un
 * identificativo assente, ma anche un guasto di configurazione vero che
 * {@code ValuationChain.build} puo' lanciare. Scartare la causa renderebbe quel guasto
 * indistinguibile, nei log, da un id semplicemente sbagliato.
 */
class UnknownAuctionExceptionTest {

    @Test
    void portaLaCausaOriginale() {
        IllegalArgumentException causa = new IllegalArgumentException("guasto di configurazione");

        UnknownAuctionException e = new UnknownAuctionException("2025-08-30", causa);

        assertThat(e.getCause()).isSameAs(causa);
        assertThat(e.getMessage()).contains("2025-08-30");
    }
}
