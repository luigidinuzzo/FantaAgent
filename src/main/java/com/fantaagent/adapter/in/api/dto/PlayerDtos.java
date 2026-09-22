package com.fantaagent.adapter.in.api.dto;

import com.fantaagent.application.service.PlayerSearchService;
import com.fantaagent.domain.player.Player;
import com.fantaagent.domain.player.Role;
import com.fantaagent.domain.strategy.PriceRecommendation;

import java.util.List;

public final class PlayerDtos {

    private PlayerDtos() {
    }

    public record PlayerSummary(String id, String name, String team, Role role, int listPrice) {

        public static PlayerSummary from(Player p) {
            return new PlayerSummary(p.id(), p.name(), p.team(), p.role(), p.listPrice());
        }
    }

    public record DriverView(String label, double contribution, String explanation) {
    }

    /**
     * {@code worthPursuing} viaggia calcolato invece di lasciare che sia
     * l'interfaccia a confrontare margine e tetto: la regola "prendi o lascia"
     * appartiene al dominio, e riscriverla in TypeScript significherebbe avere
     * due versioni della stessa decisione che possono divergere.
     */
    public record ValuationResponse(String playerId, String name, String team, Role role,
                                    int listPrice, int expectedPrice, int maxBid, int hardCap,
                                    int margin, String walkAwayReason, boolean worthPursuing,
                                    int confidenceStars, List<DriverView> drivers) {

        public static ValuationResponse from(Player player, PriceRecommendation r) {
            return new ValuationResponse(player.id(), player.name(), player.team(),
                    player.role(), player.listPrice(), r.expectedPrice(), r.maxBid(),
                    r.hardCap(), r.margin(), r.walkAwayReason(), r.worthPursuing(),
                    r.confidence().stars(),
                    r.drivers().stream()
                            .map(d -> new DriverView(d.label(), d.contribution(), d.explanation()))
                            .toList());
        }
    }

    public record PhaseRowView(String id, String name, String team, Role role, int listPrice,
                               int maxBid, int expectedPrice, int margin,
                               double fantamediaAttesa, double titolaritaPercent) {

        public static PhaseRowView from(PlayerSearchService.PhaseRow row) {
            Player p = row.player();
            PriceRecommendation r = row.recommendation();
            return new PhaseRowView(p.id(), p.name(), p.team(), p.role(), p.listPrice(),
                    r.maxBid(), r.expectedPrice(), r.margin(),
                    row.fantamediaAttesa(), row.titolaritaPercent());
        }
    }

    /**
     * Un'occasione della fase: un giocatore libero del ruolo in corso, con quanto lo
     * paghera' il mercato e fin dove conviene spingersi. Serve al pannello dei
     * consigli quando nessun giocatore e' ancora sul battitore.
     */
    public record TargetView(String id, String name, String team, Role role, int listPrice,
                             int maxBid, int expectedPrice, int margin, boolean worthPursuing) {

        public static TargetView from(PlayerSearchService.TargetRow row) {
            Player p = row.player();
            PriceRecommendation r = row.recommendation();
            return new TargetView(p.id(), p.name(), p.team(), p.role(), p.listPrice(),
                    r.maxBid(), r.expectedPrice(), r.margin(), r.worthPursuing());
        }
    }

    public record PhasePageResponse(List<PhaseRowView> rows, int offset, int pageSize,
                                    int total, boolean hasPrevious, boolean hasNext) {

        public static PhasePageResponse from(PlayerSearchService.PhasePage page) {
            return new PhasePageResponse(page.rows().stream().map(PhaseRowView::from).toList(),
                    page.offset(), page.pageSize(), page.total(),
                    page.hasPrevious(), page.hasNext());
        }
    }
}
