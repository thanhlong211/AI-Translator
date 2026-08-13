package com.dangt.aitranslator.backend.admin;

import java.time.Instant;

public record AdminTransactionResponse(
        long id,
        String publicId,
        long userId,
        String userEmail,
        String planCode,
        String planDisplayName,
        Long priceId,
        String billingPeriod,
        String currency,
        long amountMinor,
        long refundedAmountMinor,
        String provider,
        String providerReference,
        String status,
        Long subscriptionId,
        String failureCode,
        String failureMessage,
        Instant paidAt,
        Instant failedAt,
        Instant canceledAt,
        Instant refundedAt,
        Long createdByUserId,
        String createdByEmail,
        Instant createdAt,
        Instant updatedAt
) {
}
