package com.dangt.aitranslator.backend.admin;

import java.math.BigDecimal;
import java.time.LocalDate;

public record AdminAiCostDailyResponse(
        LocalDate date,
        long requests,
        long successfulRequests,
        long failedRequests,
        long inputTokens,
        long cachedTokens,
        long outputTokens,
        long totalTokens,
        BigDecimal estimatedCost,
        BigDecimal averageLatencyMs,
        long missingRateEvents
) {
}
