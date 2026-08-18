package com.dangt.aitranslator.backend.payment;

public record LemonSqueezyWebhookResponse(
        boolean received,
        boolean duplicate,
        String eventType
) {
}
