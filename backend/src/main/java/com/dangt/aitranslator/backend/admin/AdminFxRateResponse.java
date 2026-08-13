package com.dangt.aitranslator.backend.admin;

import java.math.BigDecimal;
import java.time.Instant;

public record AdminFxRateResponse(
        long id,
        String baseCurrency,
        String quoteCurrency,
        BigDecimal rate,
        boolean active,
        Instant effectiveFrom,
        Instant effectiveTo,
        boolean currentlyEffective,
        String notes,
        Long createdByUserId,
        String createdByEmail,
        Instant createdAt,
        Instant updatedAt
) {
}
