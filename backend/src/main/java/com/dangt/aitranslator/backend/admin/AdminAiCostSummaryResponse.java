package com.dangt.aitranslator.backend.admin;

import java.math.BigDecimal;

public record AdminAiCostSummaryResponse(
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
        long tokenUsageUnavailableEvents
) {
}
