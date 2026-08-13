package com.dangt.aitranslator.backend.usage;

import java.math.BigDecimal;
import java.time.Instant;

public record AiCostSnapshot(
        String status,
        Long modelCostId,
        String currency,
        BigDecimal inputRatePerMillion,
        BigDecimal cachedInputRatePerMillion,
        BigDecimal outputRatePerMillion,
        BigDecimal inputCost,
        BigDecimal cachedInputCost,
        BigDecimal outputCost,
        BigDecimal estimatedCost,
        Instant calculatedAt
) {
}
