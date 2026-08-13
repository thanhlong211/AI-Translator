package com.dangt.aitranslator.backend.catalog;

import java.time.Instant;

public record PublicCatalogPriceResponse(
        long id,
        String billingPeriod,
        String currency,
        long amountMinor,
        Long compareAtAmountMinor,
        Instant startsAt,
        Instant endsAt
) {
}
