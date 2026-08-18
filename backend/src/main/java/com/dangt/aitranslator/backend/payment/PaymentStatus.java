package com.dangt.aitranslator.backend.payment;

import java.util.Locale;

public enum PaymentStatus {

    PENDING,
    SUCCEEDED,
    FAILED,
    CANCELED,
    REFUNDED;

    public static PaymentStatus from(
            String value
    ) {
        String normalized =
                String.valueOf(
                                value == null
                                        ? ""
                                        : value
                        )
                        .trim()
                        .toUpperCase(
                                Locale.ROOT
                        );

        try {
            return valueOf(
                    normalized
            );
        } catch (
                IllegalArgumentException ex
        ) {
            throw new IllegalStateException(
                    "Payment status không hợp lệ: "
                            + normalized
            );
        }
    }
}
