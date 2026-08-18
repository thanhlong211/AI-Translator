package com.dangt.aitranslator.backend.payment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record PaymentCheckoutRequest(
        @Positive
        long priceId,

        @NotBlank
        @Size(max = 190)
        String idempotencyKey
) {
}
