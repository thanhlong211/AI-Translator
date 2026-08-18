package com.dangt.aitranslator.backend.payment;

import java.util.Locale;

public enum PaymentProvider {

    MANUAL,
    LEMON_SQUEEZY,
    PADDLE;

    public String dbValue() {
        return name();
    }

    public static PaymentProvider from(
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

        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(
                    "Payment provider không hợp lệ."
            );
        }

        try {
            return valueOf(
                    normalized
            );
        } catch (
                IllegalArgumentException ex
        ) {
            throw new IllegalArgumentException(
                    "Payment provider không được hỗ trợ: "
                            + normalized
            );
        }
    }
}
