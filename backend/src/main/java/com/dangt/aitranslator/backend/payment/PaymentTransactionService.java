package com.dangt.aitranslator.backend.payment;

import com.dangt.aitranslator.backend.billing.RevenueNormalizationService;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class PaymentTransactionService {

    private final JdbcTemplate jdbcTemplate;
    private final RevenueNormalizationService
            revenueNormalizationService;

    public PaymentTransactionService(
            JdbcTemplate jdbcTemplate,
            RevenueNormalizationService
                    revenueNormalizationService
    ) {
        this.jdbcTemplate =
                jdbcTemplate;

        this.revenueNormalizationService =
                revenueNormalizationService;
    }

    @Transactional
    public PaymentTransaction createPending(
            long userId,
            long priceId,
            PaymentProvider provider,
            String idempotencyKey
    ) {
        if (userId <= 0) {
            throw new IllegalArgumentException(
                    "User ID không hợp lệ."
            );
        }

        if (priceId <= 0) {
            throw new IllegalArgumentException(
                    "Price ID không hợp lệ."
            );
        }

        if (
                provider == null
                || provider
                == PaymentProvider.MANUAL
        ) {
            throw new IllegalArgumentException(
                    "Provider checkout không hợp lệ."
            );
        }

        String cleanIdempotencyKey =
                cleanRequired(
                        idempotencyKey,
                        190,
                        "Idempotency key"
                );

        PaymentTransaction existing =
                findByIdempotencyKey(
                        provider,
                        cleanIdempotencyKey
                );

        if (existing != null) {
            ensureSameIntent(
                    existing,
                    userId,
                    priceId
            );

            return existing;
        }

        requireActiveUser(
                userId
        );

        PriceSnapshot price =
                requireSellablePrice(
                        priceId
                );

        requireActivePlan(
                price.planCode()
        );

        String publicId =
                "AIT-TX-"
                        + UUID.randomUUID()
                        .toString()
                        .replace(
                                "-",
                                ""
                        )
                        .toUpperCase(
                                Locale.ROOT
                        );

        try {
            jdbcTemplate.update(
                    """
                    INSERT INTO payment_transactions (
                        public_id,
                        user_id,
                        plan_code,
                        price_id,
                        billing_period,
                        currency,
                        amount_minor,
                        refunded_amount_minor,
                        provider,
                        provider_reference,
                        idempotency_key,
                        status,
                        subscription_id,
                        created_by_user_id,
                        created_at,
                        updated_at
                    ) VALUES (
                        ?, ?, ?, ?, ?, ?, ?,
                        0,
                        ?,
                        NULL,
                        ?,
                        'PENDING',
                        NULL,
                        NULL,
                        CURRENT_TIMESTAMP(6),
                        CURRENT_TIMESTAMP(6)
                    )
                    """,
                    publicId,
                    userId,
                    price.planCode(),
                    price.id(),
                    price.billingPeriod(),
                    price.currency(),
                    price.amountMinor(),
                    provider.dbValue(),
                    cleanIdempotencyKey
            );
        } catch (
                DuplicateKeyException ex
        ) {
            PaymentTransaction concurrent =
                    findByIdempotencyKey(
                            provider,
                            cleanIdempotencyKey
                    );

            if (concurrent == null) {
                throw ex;
            }

            ensureSameIntent(
                    concurrent,
                    userId,
                    priceId
            );

            return concurrent;
        }

        return requireByPublicId(
                publicId,
                false
        );
    }

    @Transactional
    public PaymentTransaction attachCheckout(
            String publicId,
            String checkoutReference,
            String checkoutUrl
    ) {
        PaymentTransaction transaction =
                requireByPublicId(
                        cleanRequired(
                                publicId,
                                80,
                                "Transaction"
                        ),
                        true
                );

        requireStatus(
                transaction,
                PaymentStatus.PENDING
        );

        String cleanReference =
                cleanRequired(
                        checkoutReference,
                        190,
                        "Checkout reference"
                );

        String cleanUrl =
                cleanRequired(
                        checkoutUrl,
                        1000,
                        "Checkout URL"
                );

        if (
                transaction.checkoutReference()
                        != null
                && !transaction
                .checkoutReference()
                .equals(
                        cleanReference
                )
        ) {
            throw new IllegalStateException(
                    "Transaction đã được gắn với checkout khác."
            );
        }

        jdbcTemplate.update(
                """
                UPDATE payment_transactions
                SET checkout_reference = ?,
                    checkout_url = ?,
                    updated_at =
                        CURRENT_TIMESTAMP(6)
                WHERE id = ?
                """,
                cleanReference,
                cleanUrl,
                transaction.id()
        );

        return requireById(
                transaction.id(),
                false
        );
    }

    @Transactional
    public PaymentTransaction attachProviderReferences(
            String publicId,
            String providerReference,
            String providerCustomerReference,
            String providerSubscriptionReference
    ) {
        PaymentTransaction before =
                requireByPublicId(
                        cleanRequired(
                                publicId,
                                80,
                                "Transaction"
                        ),
                        true
                );

        String cleanProviderReference =
                cleanOptional(
                        providerReference,
                        190
                );

        String cleanCustomerReference =
                cleanOptional(
                        providerCustomerReference,
                        190
                );

        String cleanSubscriptionReference =
                cleanOptional(
                        providerSubscriptionReference,
                        190
                );

        ensureCompatibleReference(
                "Provider reference",
                before.providerReference(),
                cleanProviderReference
        );

        ensureCompatibleReference(
                "Provider customer reference",
                before.providerCustomerReference(),
                cleanCustomerReference
        );

        ensureCompatibleReference(
                "Provider subscription reference",
                before.providerSubscriptionReference(),
                cleanSubscriptionReference
        );

        jdbcTemplate.update(
                """
                UPDATE payment_transactions
                SET provider_reference =
                        COALESCE(
                            provider_reference,
                            ?
                        ),
                    provider_customer_reference =
                        COALESCE(
                            provider_customer_reference,
                            ?
                        ),
                    provider_subscription_reference =
                        COALESCE(
                            provider_subscription_reference,
                            ?
                        ),
                    updated_at =
                        CURRENT_TIMESTAMP(6)
                WHERE id = ?
                """,
                cleanProviderReference,
                cleanCustomerReference,
                cleanSubscriptionReference,
                before.id()
        );

        return requireById(
                before.id(),
                false
        );
    }

    private static void ensureCompatibleReference(
            String label,
            String existing,
            String incoming
    ) {
        if (
                incoming == null
                        || existing == null
        ) {
            return;
        }

        if (!existing.equals(incoming)) {
            throw new IllegalStateException(
                    label
                            + " không khớp giá trị đã lưu."
            );
        }
    }

    @Transactional
    public PaymentTransaction markSucceeded(
            String publicId,
            String providerReference,
            String providerCustomerReference,
            String providerSubscriptionReference,
            Instant paidAt
    ) {
        PaymentTransaction before =
                requireByPublicId(
                        cleanRequired(
                                publicId,
                                80,
                                "Transaction"
                        ),
                        true
                );

        if (
                before.status()
                == PaymentStatus.SUCCEEDED
                || before.status()
                == PaymentStatus.REFUNDED
        ) {
            return before;
        }

        requireStatus(
                before,
                PaymentStatus.PENDING
        );

        requireActivePlan(
                before.planCode()
        );

        Instant effectivePaidAt =
                paidAt == null
                        ? Instant.now()
                        : paidAt;

        Long monthlyLimit =
                jdbcTemplate.queryForObject(
                        """
                        SELECT
                            COALESCE(
                                MAX(limit_value),
                                0
                            )
                        FROM plan_limits
                        WHERE plan_code = ?
                          AND limit_key =
                              'monthlyTranslations'
                        """,
                        Long.class,
                        before.planCode()
                );

        Instant periodEnd =
                defaultEnd(
                        effectivePaidAt,
                        before.billingPeriod()
                );

        jdbcTemplate.update(
                """
                INSERT INTO subscriptions (
                    user_id,
                    plan,
                    status,
                    source,
                    reference_id,
                    price_id,
                    monthly_translation_limit,
                    period_start,
                    period_end,
                    canceled_at,
                    cancel_reason,
                    created_at,
                    updated_at
                ) VALUES (
                    ?,
                    ?,
                    'ACTIVE',
                    'PAYMENT',
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    NULL,
                    NULL,
                    CURRENT_TIMESTAMP(6),
                    CURRENT_TIMESTAMP(6)
                )
                """,
                before.userId(),
                before.planCode(),
                before.id(),
                before.priceId(),
                monthlyLimit == null
                        ? 0L
                        : monthlyLimit,
                Timestamp.from(
                        effectivePaidAt
                ),
                toTimestamp(
                        periodEnd
                )
        );

        Long subscriptionId =
                jdbcTemplate.queryForObject(
                        "SELECT LAST_INSERT_ID()",
                        Long.class
                );

        if (
                subscriptionId == null
                || subscriptionId <= 0
        ) {
            throw new IllegalStateException(
                    "Không xác định được subscription từ payment."
            );
        }

        jdbcTemplate.update(
                """
                UPDATE payment_transactions
                SET status = 'SUCCEEDED',
                    provider_reference = ?,
                    provider_customer_reference = ?,
                    provider_subscription_reference = ?,
                    subscription_id = ?,
                    paid_at = ?,
                    failure_code = NULL,
                    failure_message = NULL,
                    updated_at =
                        CURRENT_TIMESTAMP(6)
                WHERE id = ?
                """,
                cleanOptional(
                        providerReference,
                        190
                ),
                cleanOptional(
                        providerCustomerReference,
                        190
                ),
                cleanOptional(
                        providerSubscriptionReference,
                        190
                ),
                subscriptionId,
                Timestamp.from(
                        effectivePaidAt
                ),
                before.id()
        );

        revenueNormalizationService
                .normalizeTransaction(
                        before.id()
                );

        return requireById(
                before.id(),
                false
        );
    }

    @Transactional
    public PaymentTransaction markFailed(
            String publicId,
            String failureCode,
            String failureMessage
    ) {
        PaymentTransaction before =
                requireByPublicId(
                        cleanRequired(
                                publicId,
                                80,
                                "Transaction"
                        ),
                        true
                );

        if (
                before.status()
                != PaymentStatus.PENDING
        ) {
            return before;
        }

        jdbcTemplate.update(
                """
                UPDATE payment_transactions
                SET status = 'FAILED',
                    failure_code = ?,
                    failure_message = ?,
                    failed_at =
                        CURRENT_TIMESTAMP(6),
                    updated_at =
                        CURRENT_TIMESTAMP(6)
                WHERE id = ?
                """,
                cleanOptional(
                        failureCode,
                        100
                ),
                cleanOptional(
                        failureMessage,
                        500
                ),
                before.id()
        );

        return requireById(
                before.id(),
                false
        );
    }

    @Transactional
    public PaymentTransaction markCanceled(
            String publicId
    ) {
        PaymentTransaction before =
                requireByPublicId(
                        cleanRequired(
                                publicId,
                                80,
                                "Transaction"
                        ),
                        true
                );

        if (
                before.status()
                != PaymentStatus.PENDING
        ) {
            return before;
        }

        jdbcTemplate.update(
                """
                UPDATE payment_transactions
                SET status = 'CANCELED',
                    canceled_at =
                        CURRENT_TIMESTAMP(6),
                    updated_at =
                        CURRENT_TIMESTAMP(6)
                WHERE id = ?
                """,
                before.id()
        );

        return requireById(
                before.id(),
                false
        );
    }

    @Transactional
    public PaymentTransaction markRefunded(
            String publicId
    ) {
        PaymentTransaction before =
                requireByPublicId(
                        cleanRequired(
                                publicId,
                                80,
                                "Transaction"
                        ),
                        true
                );

        if (
                before.status()
                == PaymentStatus.REFUNDED
        ) {
            return before;
        }

        requireStatus(
                before,
                PaymentStatus.SUCCEEDED
        );

        if (
                before.subscriptionId()
                != null
        ) {
            jdbcTemplate.update(
                    """
                    UPDATE subscriptions
                    SET status = 'CANCELED',
                        canceled_at =
                            CURRENT_TIMESTAMP(6),
                        cancel_reason =
                            'Payment refunded by provider.',
                        updated_at =
                            CURRENT_TIMESTAMP(6)
                    WHERE id = ?
                      AND source = 'PAYMENT'
                      AND reference_id = ?
                    """,
                    before.subscriptionId(),
                    before.id()
            );
        }

        jdbcTemplate.update(
                """
                UPDATE payment_transactions
                SET status = 'REFUNDED',
                    refunded_amount_minor =
                        amount_minor,
                    refunded_at =
                        CURRENT_TIMESTAMP(6),
                    updated_at =
                        CURRENT_TIMESTAMP(6)
                WHERE id = ?
                """,
                before.id()
        );

        revenueNormalizationService
                .normalizeTransaction(
                        before.id()
                );

        return requireById(
                before.id(),
                false
        );
    }

    @Transactional(readOnly = true)
    public PaymentTransaction findByPublicId(
            String publicId
    ) {
        return requireByPublicId(
                cleanRequired(
                        publicId,
                        80,
                        "Transaction"
                ),
                false
        );
    }

    private PaymentTransaction
    findByIdempotencyKey(
            PaymentProvider provider,
            String idempotencyKey
    ) {
        List<PaymentTransaction> rows =
                jdbcTemplate.query(
                        transactionSelectSql()
                                + """
                                 WHERE pt.provider = ?
                                   AND pt.idempotency_key = ?
                                 LIMIT 1
                                """,
                        (rs, rowNum) ->
                                mapTransaction(
                                        rs
                                ),
                        provider.dbValue(),
                        idempotencyKey
                );

        return rows.isEmpty()
                ? null
                : rows.getFirst();
    }

    private PaymentTransaction
    requireByPublicId(
            String publicId,
            boolean forUpdate
    ) {
        String suffix =
                forUpdate
                        ? """
                         WHERE pt.public_id = ?
                         LIMIT 1
                         FOR UPDATE
                        """
                        : """
                         WHERE pt.public_id = ?
                         LIMIT 1
                        """;

        List<PaymentTransaction> rows =
                jdbcTemplate.query(
                        transactionSelectSql()
                                + suffix,
                        (rs, rowNum) ->
                                mapTransaction(
                                        rs
                                ),
                        publicId
                );

        if (rows.isEmpty()) {
            throw new IllegalArgumentException(
                    "Không tìm thấy payment transaction."
            );
        }

        return rows.getFirst();
    }

    private PaymentTransaction requireById(
            long id,
            boolean forUpdate
    ) {
        String suffix =
                forUpdate
                        ? """
                         WHERE pt.id = ?
                         LIMIT 1
                         FOR UPDATE
                        """
                        : """
                         WHERE pt.id = ?
                         LIMIT 1
                        """;

        List<PaymentTransaction> rows =
                jdbcTemplate.query(
                        transactionSelectSql()
                                + suffix,
                        (rs, rowNum) ->
                                mapTransaction(
                                        rs
                                ),
                        id
                );

        if (rows.isEmpty()) {
            throw new IllegalArgumentException(
                    "Không tìm thấy payment transaction."
            );
        }

        return rows.getFirst();
    }

    private void requireActiveUser(
            long userId
    ) {
        Integer count =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM users
                        WHERE id = ?
                          AND status = 'ACTIVE'
                        """,
                        Integer.class,
                        userId
                );

        if (
                count == null
                || count == 0
        ) {
            throw new IllegalArgumentException(
                    "User không tồn tại hoặc đang bị khóa."
            );
        }
    }

    private PriceSnapshot
    requireSellablePrice(
            long priceId
    ) {
        List<PriceSnapshot> rows =
                jdbcTemplate.query(
                        """
                        SELECT
                            id,
                            plan_code,
                            billing_period,
                            currency,
                            amount_minor,
                            active,
                            sellable,
                            starts_at,
                            ends_at
                        FROM plan_prices
                        WHERE id = ?
                        LIMIT 1
                        """,
                        (rs, rowNum) ->
                                new PriceSnapshot(
                                        rs.getLong(
                                                "id"
                                        ),
                                        rs.getString(
                                                "plan_code"
                                        ),
                                        rs.getString(
                                                "billing_period"
                                        ),
                                        rs.getString(
                                                "currency"
                                        ),
                                        rs.getLong(
                                                "amount_minor"
                                        ),
                                        rs.getBoolean(
                                                "active"
                                        ),
                                        rs.getBoolean(
                                                "sellable"
                                        ),
                                        toInstant(
                                                rs.getTimestamp(
                                                        "starts_at"
                                                )
                                        ),
                                        toInstant(
                                                rs.getTimestamp(
                                                        "ends_at"
                                                )
                                        )
                                ),
                        priceId
                );

        if (rows.isEmpty()) {
            throw new IllegalArgumentException(
                    "Price không tồn tại."
            );
        }

        PriceSnapshot price =
                rows.getFirst();

        Instant now =
                Instant.now();

        boolean available =
                price.active()
                        && price.sellable()
                        && (
                        price.startsAt()
                                == null
                        || !price.startsAt()
                        .isAfter(
                                now
                        )
                )
                        && (
                        price.endsAt()
                                == null
                        || price.endsAt()
                        .isAfter(
                                now
                        )
                );

        if (!available) {
            throw new IllegalArgumentException(
                    "Price hiện không ở trạng thái ON SALE."
            );
        }

        return price;
    }

    private void requireActivePlan(
            String planCode
    ) {
        Integer count =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM plan_catalog
                        WHERE code = ?
                          AND active = TRUE
                        """,
                        Integer.class,
                        planCode
                );

        if (
                count == null
                || count == 0
        ) {
            throw new IllegalArgumentException(
                    "Plan hiện đang bị tắt."
            );
        }
    }

    private static void ensureSameIntent(
            PaymentTransaction transaction,
            long userId,
            long priceId
    ) {
        if (
                transaction.userId()
                != userId
                || transaction.priceId()
                == null
                || transaction.priceId()
                != priceId
        ) {
            throw new IllegalStateException(
                    "Idempotency key đã được dùng cho payment khác."
            );
        }
    }

    private static void requireStatus(
            PaymentTransaction transaction,
            PaymentStatus expected
    ) {
        if (
                transaction.status()
                != expected
        ) {
            throw new IllegalStateException(
                    "Transaction phải ở trạng thái "
                            + expected
                            + " nhưng hiện là "
                            + transaction.status()
                            + "."
            );
        }
    }

    private static Instant defaultEnd(
            Instant startsAt,
            String billingPeriod
    ) {
        return switch (
                String.valueOf(
                                billingPeriod
                        )
                        .toUpperCase(
                                Locale.ROOT
                        )
        ) {
            case "MONTHLY" ->
                    startsAt
                            .atZone(
                                    ZoneOffset.UTC
                            )
                            .plusMonths(1)
                            .toInstant();

            case "YEARLY" ->
                    startsAt
                            .atZone(
                                    ZoneOffset.UTC
                            )
                            .plusYears(1)
                            .toInstant();

            case "LIFETIME" ->
                    null;

            default ->
                    throw new IllegalArgumentException(
                            "Billing period của transaction không hợp lệ."
                    );
        };
    }

    private static String
    cleanRequired(
            String value,
            int max,
            String label
    ) {
        String clean =
                String.valueOf(
                                value == null
                                        ? ""
                                        : value
                        )
                        .trim();

        if (clean.isEmpty()) {
            throw new IllegalArgumentException(
                    label + " là bắt buộc."
            );
        }

        if (clean.length() > max) {
            throw new IllegalArgumentException(
                    label + " quá dài."
            );
        }

        return clean;
    }

    private static String
    cleanOptional(
            String value,
            int max
    ) {
        String clean =
                String.valueOf(
                                value == null
                                        ? ""
                                        : value
                        )
                        .trim();

        if (clean.isEmpty()) {
            return null;
        }

        return clean.length() <= max
                ? clean
                : clean.substring(
                        0,
                        max
                );
    }

    private static PaymentTransaction
    mapTransaction(
            ResultSet rs
    ) throws SQLException {
        return new PaymentTransaction(
                rs.getLong("id"),
                rs.getString("public_id"),
                rs.getLong("user_id"),
                rs.getString("plan_code"),
                nullableLong(
                        rs.getObject(
                                "price_id"
                        )
                ),
                rs.getString(
                        "billing_period"
                ),
                rs.getString(
                        "currency"
                ),
                rs.getLong(
                        "amount_minor"
                ),
                rs.getLong(
                        "refunded_amount_minor"
                ),
                PaymentProvider.from(
                        rs.getString(
                                "provider"
                        )
                ),
                rs.getString(
                        "provider_reference"
                ),
                rs.getString(
                        "idempotency_key"
                ),
                rs.getString(
                        "checkout_reference"
                ),
                rs.getString(
                        "checkout_url"
                ),
                rs.getString(
                        "provider_customer_reference"
                ),
                rs.getString(
                        "provider_subscription_reference"
                ),
                PaymentStatus.from(
                        rs.getString(
                                "status"
                        )
                ),
                nullableLong(
                        rs.getObject(
                                "subscription_id"
                        )
                ),
                rs.getString(
                        "failure_code"
                ),
                rs.getString(
                        "failure_message"
                ),
                toInstant(
                        rs.getTimestamp(
                                "paid_at"
                        )
                ),
                toInstant(
                        rs.getTimestamp(
                                "failed_at"
                        )
                ),
                toInstant(
                        rs.getTimestamp(
                                "canceled_at"
                        )
                ),
                toInstant(
                        rs.getTimestamp(
                                "refunded_at"
                        )
                ),
                toInstant(
                        rs.getTimestamp(
                                "created_at"
                        )
                ),
                toInstant(
                        rs.getTimestamp(
                                "updated_at"
                        )
                )
        );
    }

    private static String
    transactionSelectSql() {
        return """
                SELECT
                    pt.id,
                    pt.public_id,
                    pt.user_id,
                    pt.plan_code,
                    pt.price_id,
                    pt.billing_period,
                    pt.currency,
                    pt.amount_minor,
                    pt.refunded_amount_minor,
                    pt.provider,
                    pt.provider_reference,
                    pt.idempotency_key,
                    pt.checkout_reference,
                    pt.checkout_url,
                    pt.provider_customer_reference,
                    pt.provider_subscription_reference,
                    pt.status,
                    pt.subscription_id,
                    pt.failure_code,
                    pt.failure_message,
                    pt.paid_at,
                    pt.failed_at,
                    pt.canceled_at,
                    pt.refunded_at,
                    pt.created_at,
                    pt.updated_at
                FROM payment_transactions pt
                """;
    }

    private static Long nullableLong(
            Object value
    ) {
        return value == null
                ? null
                : ((Number) value)
                .longValue();
    }

    private static Timestamp toTimestamp(
            Instant value
    ) {
        return value == null
                ? null
                : Timestamp.from(
                        value
                );
    }

    private static Instant toInstant(
            Timestamp value
    ) {
        return value == null
                ? null
                : value.toInstant();
    }

    private record PriceSnapshot(
            long id,
            String planCode,
            String billingPeriod,
            String currency,
            long amountMinor,
            boolean active,
            boolean sellable,
            Instant startsAt,
            Instant endsAt
    ) {
    }
}
