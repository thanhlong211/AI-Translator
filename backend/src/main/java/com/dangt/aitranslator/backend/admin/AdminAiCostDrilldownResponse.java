package com.dangt.aitranslator.backend.admin;

import java.time.Instant;
import java.util.List;

public record AdminAiCostDrilldownResponse(
        String reportingCurrency,
        String analyticsTimeZone,
        int days,
        Instant from,
        Instant to,
        String dimension,
        String key,
        String label,
        AdminAiCostSummaryResponse summary,
        List<AdminAiCostBreakdownResponse> users,
        List<AdminAiCostBreakdownResponse> plans,
        List<AdminAiCostBreakdownResponse> features,
        List<AdminAiCostBreakdownResponse> providers,
        List<AdminAiCostBreakdownResponse> models,
        List<AdminAiUsageResponse> recent
) {
}
