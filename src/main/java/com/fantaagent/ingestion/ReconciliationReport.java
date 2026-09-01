package com.fantaagent.ingestion;

import java.util.List;

public record ReconciliationReport(List<String> warnings, int accepted, int rejected) {

    public ReconciliationReport {
        warnings = List.copyOf(warnings);
    }

    public boolean clean() {
        return rejected == 0 && warnings.isEmpty();
    }

    public String render() {
        StringBuilder sb = new StringBuilder();
        sb.append("accettati=").append(accepted)
          .append(" scartati=").append(rejected).append('\n');
        warnings.forEach(w -> sb.append("  - ").append(w).append('\n'));
        return sb.toString();
    }
}
