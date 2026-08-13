package com.dangt.aitranslator.backend.admin;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record AdminAiCostDashboardResponse(
        String reportingCurrency,
        String analyticsTimeZone,
        int days,
        Instant from,
        Instant to,
        long requests,
        long successfulRequests,
        long failedRequests,
        BigDecimal successRatePercent,
        long inputTokens,
        long cachedTokens,
        long outputTokens,
        long totalTokens,
        BigDecimal estimatedCost,
        BigDecimal averageLatencyMs,
        long calculatedCostEvents,
        long missingRateEvents,
        long tokenUsageUnavailableEvents,
        List<AdminAiCostDailyResponse> daily,
        List<AdminAiCostBreakdownResponse> users,
        List<AdminAiCostBreakdownResponse> providers,
        List<AdminAiCostBreakdownResponse> models,
        List<AdminAiCostBreakdownResponse> features,
        List<AdminAiCostBreakdownResponse> plans
) {
}
