package com.dangt.aitranslator.backend.admin;

import java.time.Instant;

public record AdminSubscriptionResponse(
        long id,
        long userId,
        String userEmail,
        String planCode,
        String planDisplayName,
        String status,
        String effectiveStatus,
        String source,
        Long referenceId,
        Long priceId,
        String priceBillingPeriod,
        String priceCurrency,
        Long priceAmountMinor,
        long monthlyTranslationLimit,
        Instant periodStart,
        Instant periodEnd,
        Instant canceledAt,
        String cancelReason,
        Instant createdAt,
        Instant updatedAt
) {
}
