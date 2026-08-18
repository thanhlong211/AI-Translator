package com.dangt.aitranslator.backend.payment;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class LemonSqueezyPriceMappingService {

    private final JdbcTemplate jdbcTemplate;

    public LemonSqueezyPriceMappingService(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public String requireVariantId(
            Long priceId
    ) {
        if (
                priceId == null
                        || priceId <= 0
        ) {
            throw new IllegalStateException(
                    "Payment transaction thiếu price_id."
            );
        }

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
            throw new IllegalStateException(
                    "Price chưa được map với Lemon Squeezy."
            );
        }

        String variantId =
                rows.getFirst();

        if (
                variantId == null
                        || variantId.isBlank()
        ) {
            throw new IllegalStateException(
                    "Lemon Squeezy Variant ID bị thiếu."
            );
        }

        return variantId.trim();
    }
}
