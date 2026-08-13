package com.dangt.aitranslator.backend.billing;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Currency;
import java.util.List;
import java.util.Locale;

@Service
public class RevenueNormalizationService {

    private static final int MONEY_SCALE = 8;
    private static final int FX_SCALE = 12;

    private final JdbcTemplate jdbcTemplate;
    private final String reportingCurrency;

    public RevenueNormalizationService(
            JdbcTemplate jdbcTemplate,
            @Value("${app.ai-cost.reporting-currency:USD}") String reportingCurrency
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.reportingCurrency = normalizeCurrency(reportingCurrency);
    }

    public String reportingCurrency() {
        return reportingCurrency;
    }

    @Transactional
    public String normalizeTransaction(long transactionId) {
        TransactionAmount tx = requireTransaction(transactionId);
        if (tx.paidAt() == null) {
            return "PENDING";
        }
        return normalize(tx);
    }

    @Transactional
    public RevenueBackfillResult backfill(int requestedLimit) {
        int limit = Math.max(1, Math.min(requestedLimit, 5000));
        List<Long> ids = jdbcTemplate.query(
                """
                SELECT id
                FROM payment_transactions
                WHERE paid_at IS NOT NULL
                  AND status IN ('SUCCEEDED', 'REFUNDED')
                  AND revenue_status IN ('PENDING', 'MISSING_FX', 'UNSUPPORTED_CURRENCY')
                ORDER BY id
                LIMIT ?
                """,
                (rs, rowNum) -> rs.getLong(1),
                limit
        );

        int normalized = 0;
        int missingFx = 0;
        int unsupported = 0;
        for (Long id : ids) {
            String status = normalize(requireTransaction(id));
            if ("NORMALIZED".equals(status)) normalized++;
            else if ("MISSING_FX".equals(status)) missingFx++;
            else if ("UNSUPPORTED_CURRENCY".equals(status)) unsupported++;
        }
        return new RevenueBackfillResult(reportingCurrency, ids.size(), normalized, missingFx, unsupported);
    }

    private String normalize(TransactionAmount tx) {
        String sourceCurrency;
        try {
            sourceCurrency = normalizeCurrency(tx.currency());
            Currency.getInstance(sourceCurrency);
            Currency.getInstance(reportingCurrency);
        } catch (IllegalArgumentException ex) {
            updateFailure(tx.id(), "UNSUPPORTED_CURRENCY");
            return "UNSUPPORTED_CURRENCY";
        }

        FxSnapshot fx;
        if (sourceCurrency.equals(reportingCurrency)) {
            fx = new FxSnapshot(null, BigDecimal.ONE.setScale(FX_SCALE));
        } else {
            fx = resolveFx(sourceCurrency, reportingCurrency, tx.paidAt());
            if (fx == null) {
                updateFailure(tx.id(), "MISSING_FX");
                return "MISSING_FX";
            }
        }

        BigDecimal grossSource;
        BigDecimal refundSource;
        try {
            grossSource = minorToMajor(tx.amountMinor(), sourceCurrency);
            refundSource = minorToMajor(tx.refundedAmountMinor(), sourceCurrency);
        } catch (IllegalArgumentException ex) {
            updateFailure(tx.id(), "UNSUPPORTED_CURRENCY");
            return "UNSUPPORTED_CURRENCY";
        }
        BigDecimal gross = grossSource.multiply(fx.rate()).setScale(MONEY_SCALE, RoundingMode.HALF_UP);
        BigDecimal refunded = refundSource.multiply(fx.rate()).setScale(MONEY_SCALE, RoundingMode.HALF_UP);
        BigDecimal net = gross.subtract(refunded).setScale(MONEY_SCALE, RoundingMode.HALF_UP);

        jdbcTemplate.update(
                """
                UPDATE payment_transactions
                SET reporting_currency = ?,
                    fx_rate_id = ?,
                    fx_rate = ?,
                    gross_amount_reporting = ?,
                    refunded_amount_reporting = ?,
                    net_amount_reporting = ?,
                    revenue_status = 'NORMALIZED',
                    revenue_normalized_at = CURRENT_TIMESTAMP(6),
                    updated_at = CURRENT_TIMESTAMP(6)
                WHERE id = ?
                """,
                reportingCurrency,
                fx.id(),
                fx.rate(),
                gross,
                refunded,
                net,
                tx.id()
        );
        return "NORMALIZED";
    }

    private void updateFailure(long transactionId, String status) {
        jdbcTemplate.update(
                """
                UPDATE payment_transactions
                SET reporting_currency = ?,
                    fx_rate_id = NULL,
                    fx_rate = NULL,
                    gross_amount_reporting = NULL,
                    refunded_amount_reporting = NULL,
                    net_amount_reporting = NULL,
                    revenue_status = ?,
                    revenue_normalized_at = NULL,
                    updated_at = CURRENT_TIMESTAMP(6)
                WHERE id = ?
                """,
                reportingCurrency,
                status,
                transactionId
        );
    }

    private FxSnapshot resolveFx(String base, String quote, Instant at) {
        List<FxSnapshot> rows = jdbcTemplate.query(
                """
                SELECT id, rate
                FROM currency_exchange_rates
                WHERE base_currency = ?
                  AND quote_currency = ?
                  AND active = TRUE
                  AND effective_from <= ?
                  AND (effective_to IS NULL OR effective_to > ?)
                ORDER BY effective_from DESC, id DESC
                LIMIT 1
                """,
                (rs, rowNum) -> new FxSnapshot(
                        rs.getLong("id"),
                        rs.getBigDecimal("rate").setScale(FX_SCALE, RoundingMode.HALF_UP)
                ),
                base,
                quote,
                Timestamp.from(at),
                Timestamp.from(at)
        );
        return rows.isEmpty() ? null : rows.getFirst();
    }

    private TransactionAmount requireTransaction(long transactionId) {
        List<TransactionAmount> rows = jdbcTemplate.query(
                """
                SELECT id, currency, amount_minor, refunded_amount_minor, paid_at
                FROM payment_transactions
                WHERE id = ?
                LIMIT 1
                """,
                (rs, rowNum) -> new TransactionAmount(
                        rs.getLong("id"),
                        rs.getString("currency"),
                        rs.getLong("amount_minor"),
                        rs.getLong("refunded_amount_minor"),
                        rs.getTimestamp("paid_at") == null ? null : rs.getTimestamp("paid_at").toInstant()
                ),
                transactionId
        );
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Không tìm thấy payment transaction.");
        }
        return rows.getFirst();
    }

    private static BigDecimal minorToMajor(long amountMinor, String currencyCode) {
        Currency currency = Currency.getInstance(currencyCode);
        int digits = currency.getDefaultFractionDigits();
        if (digits < 0) {
            throw new IllegalArgumentException("Currency không hỗ trợ minor-unit conversion: " + currencyCode);
        }
        return BigDecimal.valueOf(amountMinor).movePointLeft(digits);
    }

    private static String normalizeCurrency(String value) {
        String clean = String.valueOf(value == null ? "" : value).trim().toUpperCase(Locale.ROOT);
        if (!clean.matches("[A-Z]{3}")) {
            throw new IllegalArgumentException("Currency phải là mã ISO 3 ký tự.");
        }
        return clean;
    }

    private record FxSnapshot(Long id, BigDecimal rate) {
    }

    private record TransactionAmount(
            long id,
            String currency,
            long amountMinor,
            long refundedAmountMinor,
            Instant paidAt
    ) {
    }
}
