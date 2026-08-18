package com.dangt.aitranslator.backend.payment;

import java.time.Instant;

public record PaymentTransaction(
        long id,
        String publicId,
        long userId,
        String planCode,
        Long priceId,
        String billingPeriod,
        String currency,
        long amountMinor,
        long refundedAmountMinor,
        PaymentProvider provider,
        String providerReference,
        String idempotencyKey,
        String checkoutReference,
        String checkoutUrl,
        String providerCustomerReference,
        String providerSubscriptionReference,
        PaymentStatus status,
        Long subscriptionId,
        String failureCode,
        String failureMessage,
        Instant paidAt,
        Instant failedAt,
        Instant canceledAt,
        Instant refundedAt,
        Instant createdAt,
        Instant updatedAt
) {
}
