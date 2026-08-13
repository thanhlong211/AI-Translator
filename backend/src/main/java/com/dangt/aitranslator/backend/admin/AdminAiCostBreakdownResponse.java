package com.dangt.aitranslator.backend.admin;

import java.math.BigDecimal;

public record AdminAiCostBreakdownResponse(
        String key,
        String label,
        long requests,
        long successfulRequests,
        long inputTokens,
        long cachedTokens,
        long outputTokens,
        BigDecimal estimatedCost,
        BigDecimal averageLatencyMs,
        long missingRateEvents
) {
}
