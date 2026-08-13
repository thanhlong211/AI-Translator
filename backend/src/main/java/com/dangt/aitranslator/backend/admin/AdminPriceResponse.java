package com.dangt.aitranslator.backend.admin;

import java.time.Instant;

public record AdminPriceResponse(
        long id,
        String planCode,
        String planDisplayName,
        String billingPeriod,
        String currency,
        long amountMinor,
        Long compareAtAmountMinor,
        boolean active,
        boolean sellable,
        Instant startsAt,
        Instant endsAt,
        boolean currentlyAvailable,
        Instant createdAt,
        Instant updatedAt
) {
}
