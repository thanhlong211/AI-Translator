package com.dangt.aitranslator.backend.payment;

public record PaymentWebhookClaim(
        PaymentWebhookEvent event,
        boolean claimed
) {

    public static PaymentWebhookClaim claimed(
            PaymentWebhookEvent event
    ) {
        return new PaymentWebhookClaim(
                event,
                true
        );
    }

    public static PaymentWebhookClaim duplicate(
            PaymentWebhookEvent event
    ) {
        return new PaymentWebhookClaim(
                event,
                false
        );
    }
}
