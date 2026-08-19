package com.dangt.aitranslator.backend.payment;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class PaymentCheckoutService {

    private final JdbcTemplate jdbcTemplate;
    private final PaymentTransactionService
            paymentTransactionService;
    private final LemonSqueezyClient
            lemonSqueezyClient;

    public PaymentCheckoutService(
            JdbcTemplate jdbcTemplate,
            PaymentTransactionService
                    paymentTransactionService,
            LemonSqueezyClient
                    lemonSqueezyClient
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
        this.paymentTransactionService =
                paymentTransactionService;
        this.lemonSqueezyClient =
                lemonSqueezyClient;
    }

    public PaymentCheckoutResponse createCheckout(
            long userId,
            PaymentCheckoutRequest request
    ) {
        if (request == null) {
            throw new IllegalArgumentException(
                    "Checkout request không hợp lệ."
            );
        }

        PaymentTransaction transaction =
                paymentTransactionService
                        .createPending(
                                userId,
                                request.priceId(),
                                PaymentProvider
                                        .LEMON_SQUEEZY,
                                request.idempotencyKey()
                        );

        if (
                transaction.status()
                        != PaymentStatus.PENDING
        ) {
            throw new IllegalStateException(
                    "Payment transaction hiện không ở trạng thái PENDING."
            );
        }

        if (
                transaction.checkoutReference()
                        != null
                        && !transaction
                        .checkoutReference()
                        .isBlank()
                        && transaction.checkoutUrl()
                        != null
                        && !transaction
                        .checkoutUrl()
                        .isBlank()
        ) {
            return response(
                    transaction,
                    request.priceId()
            );
        }

        String variantId =
                requireProviderVariantId(
                        request.priceId()
                );

        LemonSqueezyCheckout checkout =
                lemonSqueezyClient
                        .createCheckout(
                                variantId,
                                transaction.publicId(),
                                userId
                        );

        PaymentTransaction attached =
                paymentTransactionService
                        .attachCheckout(
                                transaction.publicId(),
                                checkout.checkoutId(),
                                checkout.checkoutUrl()
                        );

        return response(
                attached,
                request.priceId()
        );
    }

    private String requireProviderVariantId(
            long priceId
    ) {
        List<String> rows =
                jdbcTemplate.query(
                        """
                        SELECT provider_price_id
                        FROM payment_provider_prices
                        WHERE price_id = ?
                          AND provider = ?
                          AND active = TRUE
                        LIMIT 1
                        """,
                        (rs, rowNum) ->
                                rs.getString(
                                        "provider_price_id"
                                ),
                        priceId,
                        PaymentProvider
                                .LEMON_SQUEEZY
                                .dbValue()
                );

        if (rows.isEmpty()) {
            throw new IllegalArgumentException(
                    "Price chưa được map với Lemon Squeezy."
            );
        }

        String variantId =
                rows.getFirst();

        if (
                variantId == null
                        || variantId
                        .isBlank()
        ) {
            throw new IllegalStateException(
                    "Lemon Squeezy Variant ID bị thiếu."
            );
        }

        return variantId.trim();
    }

    private PaymentCheckoutResponse response(
            PaymentTransaction transaction,
            long priceId
    ) {
        return new PaymentCheckoutResponse(
                transaction.publicId(),
                priceId,
                PaymentProvider
                        .LEMON_SQUEEZY
                        .dbValue(),
                transaction.status()
                        .name(),
                transaction.checkoutReference(),
                transaction.checkoutUrl()
        );
    }
}
