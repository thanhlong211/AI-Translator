package com.dangt.aitranslator.backend.admin;

import java.math.BigDecimal;
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
        String reportingCurrency,
        Long fxRateId,
        BigDecimal fxRate,
        BigDecimal grossAmountReporting,
        BigDecimal refundedAmountReporting,
        BigDecimal netAmountReporting,
        String revenueStatus,
        Instant revenueNormalizedAt,
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
