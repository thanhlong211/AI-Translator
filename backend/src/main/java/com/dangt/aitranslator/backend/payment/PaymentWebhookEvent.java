package com.dangt.aitranslator.backend.payment;

import java.time.Instant;

public record PaymentWebhookEvent(
        long id,
        PaymentProvider provider,
        String providerEventId,
        String eventType,
        Long transactionId,
        String payloadSha256,
        String status,
        String failureMessage,
        Instant receivedAt,
        Instant processedAt
) {
}
