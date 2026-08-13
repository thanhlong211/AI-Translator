package com.dangt.aitranslator.backend.admin;

import java.math.BigDecimal;
import java.time.Instant;

public record AdminAiModelCostResponse(
        long id,
        String provider,
        String model,
        String currency,
        BigDecimal inputCostPerMillion,
        BigDecimal cachedInputCostPerMillion,
        BigDecimal outputCostPerMillion,
        boolean active,
        boolean currentlyEffective,
        Instant effectiveFrom,
        Instant effectiveTo,
        String notes,
        Long createdByUserId,
        String createdByEmail,
        Instant createdAt,
        Instant updatedAt
) {
}
