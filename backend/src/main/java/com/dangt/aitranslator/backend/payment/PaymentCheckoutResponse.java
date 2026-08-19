package com.dangt.aitranslator.backend.payment;

public record PaymentCheckoutResponse(
        String transactionPublicId,
        long priceId,
        String provider,
        String status,
        String checkoutReference,
        String checkoutUrl
) {
}
