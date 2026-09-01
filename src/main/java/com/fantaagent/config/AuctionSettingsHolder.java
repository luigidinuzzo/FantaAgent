package com.fantaagent.config;

/**
 * Le preferenze del battitore in vigore adesso.
 *
 * <p>Esiste come bean a se' e non come campo di
 * {@link com.fantaagent.application.service.AuctionRuntime} di proposito: quella classe
 * garantisce l'atomicita' della catena di valutazione tenendo UN SOLO campo mutabile, e
 * un test lo verifica per riflessione. Queste preferenze non entrano in quella catena —
 * non cambiano un solo numero calcolato — quindi non hanno bisogno di esserne parte, e
 * infilarcele romperebbe una garanzia che serve a ben altro.
 *
 * <p>Il campo e' volatile perche' la schermata Impostazioni scrive da un thread di
 * richiesta e la schermata d'asta legge da un altro: senza, un salvataggio potrebbe
 * restare invisibile a tempo indefinito, ossia esattamente il "riavvia per vedere
 * l'effetto" che si e' voluto togliere.
 */
public class AuctionSettingsHolder {

    private volatile AuctionSettings current;

    public AuctionSettingsHolder(AuctionSettings initial) {
        this.current = initial;
    }

    public AuctionSettings get() {
        return current;
    }

    public void set(AuctionSettings settings) {
        this.current = settings;
    }
}
