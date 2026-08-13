package com.dangt.aitranslator.backend.admin;

import java.math.BigDecimal;
import java.time.Instant;

public record AdminAiUsageResponse(
        long id,
        Long userId,
        String userEmail,
        String requestId,
        String provider,
        String providerRequestId,
        String model,
        String feature,
        String planCode,
        Long inputTokens,
        Long outputTokens,
        Long cachedTokens,
        Long totalTokens,
        long latencyMs,
        boolean successful,
        String errorCode,
        Long modelCostId,
        String costCurrency,
        BigDecimal inputRatePerMillion,
        BigDecimal cachedInputRatePerMillion,
        BigDecimal outputRatePerMillion,
        BigDecimal inputCost,
        BigDecimal cachedInputCost,
        BigDecimal outputCost,
        BigDecimal estimatedCost,
        String costStatus,
        Instant costCalculatedAt,
        Instant createdAt
) {
}
