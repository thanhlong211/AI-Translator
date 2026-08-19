package com.dangt.aitranslator.backend.payment;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;

@Service
public class PaymentWebhookEventService {

    private final JdbcTemplate jdbcTemplate;

    public PaymentWebhookEventService(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Claims a verified provider webhook for processing.
     *
     * IMPORTANT:
     * Signature verification must happen BEFORE this method is called.
     */
    @Transactional
    public PaymentWebhookClaim claim(
            PaymentProvider provider,
            String providerEventId,
            String eventType,
            String rawPayload
    ) {
        if (
                provider == null
                || provider == PaymentProvider.MANUAL
        ) {
            throw new IllegalArgumentException(
                    "Webhook provider không hợp lệ."
            );
        }

        String cleanEventId =
                cleanRequired(
                        providerEventId,
                        190,
                        "Provider event ID"
                );

        String cleanEventType =
                cleanRequired(
                        eventType,
                        100,
                        "Webhook event type"
                );

        if (rawPayload == null) {
            throw new IllegalArgumentException(
                    "Webhook payload là bắt buộc."
            );
        }

        String payloadHash =
                sha256Hex(
                        rawPayload
                );

        /*
         * Do not use INSERT IGNORE:
         * we only want to tolerate the expected unique-event collision,
         * not silently hide other database errors.
         *
         * ON DUPLICATE KEY leaves the existing row intact.
         */
        jdbcTemplate.update(
                """
                INSERT INTO payment_webhook_events (
                    provider,
                    provider_event_id,
                    event_type,
                    transaction_id,
                    payload_sha256,
                    status,
                    failure_message,
                    received_at,
                    processed_at
                ) VALUES (
                    ?,
                    ?,
                    ?,
                    NULL,
                    ?,
                    'RECEIVED',
                    NULL,
                    CURRENT_TIMESTAMP(6),
                    NULL
                )
                ON DUPLICATE KEY UPDATE
                    id = id
                """,
                provider.dbValue(),
                cleanEventId,
                cleanEventType,
                payloadHash
        );

        PaymentWebhookEvent event =
                requireByProviderEvent(
                        provider,
                        cleanEventId,
                        true
                );

        /*
         * Same provider event ID must always represent exactly
         * the same event body/type.
         */
        if (
                !event.payloadSha256()
                        .equalsIgnoreCase(
                                payloadHash
                        )
                || !event.eventType()
                        .equals(
                                cleanEventType
                        )
        ) {
            throw new IllegalStateException(
                    "Webhook event ID đã tồn tại nhưng payload hoặc event type không khớp."
            );
        }

        String status =
                normalizeStatus(
                        event.status()
                );

        /*
         * Already being processed or already completed:
         * provider retry is safely ignored.
         */
        if (
                "PROCESSING".equals(status)
                || "PROCESSED".equals(status)
        ) {
            return PaymentWebhookClaim
                    .duplicate(
                            event
                    );
        }

        /*
         * RECEIVED:
         *   first delivery.
         *
         * FAILED:
         *   allow a legitimate provider retry to claim the event again.
         */
        if (
                !"RECEIVED".equals(status)
                && !"FAILED".equals(status)
        ) {
            throw new IllegalStateException(
                    "Webhook event có trạng thái không hợp lệ: "
                            + status
            );
        }

        int updated =
                jdbcTemplate.update(
                        """
                        UPDATE payment_webhook_events
                        SET status = 'PROCESSING',
                            failure_message = NULL,
                            processed_at = NULL
                        WHERE id = ?
                          AND status IN (
                              'RECEIVED',
                              'FAILED'
                          )
                        """,
                        event.id()
                );

        if (updated != 1) {
            PaymentWebhookEvent current =
                    requireById(
                            event.id(),
                            false
                    );

            return PaymentWebhookClaim
                    .duplicate(
                            current
                    );
        }

        return PaymentWebhookClaim
                .claimed(
                        requireById(
                                event.id(),
                                false
                        )
                );
    }

    @Transactional
    public PaymentWebhookEvent markProcessed(
            long eventId,
            Long transactionId
    ) {
        requirePositiveId(
                eventId,
                "Webhook event ID"
        );

        if (
                transactionId != null
                && transactionId <= 0
        ) {
            throw new IllegalArgumentException(
                    "Payment transaction ID không hợp lệ."
            );
        }

        PaymentWebhookEvent before =
                requireById(
                        eventId,
                        true
                );

        String status =
                normalizeStatus(
                        before.status()
                );

        /*
         * Idempotent completion.
         */
        if ("PROCESSED".equals(status)) {
            if (
                    transactionId != null
                    && before.transactionId() != null
                    && !before.transactionId()
                    .equals(
                            transactionId
                    )
            ) {
                throw new IllegalStateException(
                        "Webhook event đã được liên kết với payment transaction khác."
                );
            }

            return before;
        }

        if (!"PROCESSING".equals(status)) {
            throw new IllegalStateException(
                    "Webhook event phải ở PROCESSING trước khi hoàn tất."
            );
        }

        jdbcTemplate.update(
                """
                UPDATE payment_webhook_events
                SET status = 'PROCESSED',
                    transaction_id = ?,
                    failure_message = NULL,
                    processed_at =
                        CURRENT_TIMESTAMP(6)
                WHERE id = ?
                  AND status = 'PROCESSING'
                """,
                transactionId,
                eventId
        );

        return requireById(
                eventId,
                false
        );
    }

    @Transactional
    public PaymentWebhookEvent markFailed(
            long eventId,
            String failureMessage
    ) {
        requirePositiveId(
                eventId,
                "Webhook event ID"
        );

        PaymentWebhookEvent before =
                requireById(
                        eventId,
                        true
                );

        String status =
                normalizeStatus(
                        before.status()
                );

        /*
         * Never downgrade an event that already completed.
         */
        if ("PROCESSED".equals(status)) {
            return before;
        }

        /*
         * Repeated failure recording is harmless.
         */
        if ("FAILED".equals(status)) {
            return before;
        }

        if (!"PROCESSING".equals(status)) {
            throw new IllegalStateException(
                    "Webhook event phải ở PROCESSING trước khi đánh dấu FAILED."
            );
        }

        jdbcTemplate.update(
                """
                UPDATE payment_webhook_events
                SET status = 'FAILED',
                    failure_message = ?,
                    processed_at =
                        CURRENT_TIMESTAMP(6)
                WHERE id = ?
                  AND status = 'PROCESSING'
                """,
                cleanOptional(
                        failureMessage,
                        500
                ),
                eventId
        );

        return requireById(
                eventId,
                false
        );
    }

    @Transactional(readOnly = true)
    public PaymentWebhookEvent find(
            PaymentProvider provider,
            String providerEventId
    ) {
        if (provider == null) {
            throw new IllegalArgumentException(
                    "Payment provider không hợp lệ."
            );
        }

        return requireByProviderEvent(
                provider,
                cleanRequired(
                        providerEventId,
                        190,
                        "Provider event ID"
                ),
                false
        );
    }

    private PaymentWebhookEvent
    requireByProviderEvent(
            PaymentProvider provider,
            String providerEventId,
            boolean forUpdate
    ) {
        String suffix =
                forUpdate
                        ? """
                         WHERE provider = ?
                           AND provider_event_id = ?
                         LIMIT 1
                         FOR UPDATE
                        """
                        : """
                         WHERE provider = ?
                           AND provider_event_id = ?
                         LIMIT 1
                        """;

        List<PaymentWebhookEvent> rows =
                jdbcTemplate.query(
                        selectSql() + suffix,
                        (rs, rowNum) ->
                                mapEvent(rs),
                        provider.dbValue(),
                        providerEventId
                );

        if (rows.isEmpty()) {
            throw new IllegalArgumentException(
                    "Không tìm thấy webhook event."
            );
        }

        return rows.getFirst();
    }

    private PaymentWebhookEvent requireById(
            long eventId,
            boolean forUpdate
    ) {
        String suffix =
                forUpdate
                        ? """
                         WHERE id = ?
                         LIMIT 1
                         FOR UPDATE
                        """
                        : """
                         WHERE id = ?
                         LIMIT 1
                        """;

        List<PaymentWebhookEvent> rows =
                jdbcTemplate.query(
                        selectSql() + suffix,
                        (rs, rowNum) ->
                                mapEvent(rs),
                        eventId
                );

        if (rows.isEmpty()) {
            throw new IllegalArgumentException(
                    "Không tìm thấy webhook event."
            );
        }

        return rows.getFirst();
    }

    private static PaymentWebhookEvent mapEvent(
            ResultSet rs
    ) throws SQLException {
        return new PaymentWebhookEvent(
                rs.getLong("id"),
                PaymentProvider.from(
                        rs.getString(
                                "provider"
                        )
                ),
                rs.getString(
                        "provider_event_id"
                ),
                rs.getString(
                        "event_type"
                ),
                nullableLong(
                        rs.getObject(
                                "transaction_id"
                        )
                ),
                rs.getString(
                        "payload_sha256"
                ),
                rs.getString(
                        "status"
                ),
                rs.getString(
                        "failure_message"
                ),
                toInstant(
                        rs.getTimestamp(
                                "received_at"
                        )
                ),
                toInstant(
                        rs.getTimestamp(
                                "processed_at"
                        )
                )
        );
    }

    private static String selectSql() {
        return """
                SELECT
                    id,
                    provider,
                    provider_event_id,
                    event_type,
                    transaction_id,
                    payload_sha256,
                    status,
                    failure_message,
                    received_at,
                    processed_at
                FROM payment_webhook_events
                """;
    }

    private static String sha256Hex(
            String rawPayload
    ) {
        try {
            MessageDigest digest =
                    MessageDigest.getInstance(
                            "SHA-256"
                    );

            byte[] hash =
                    digest.digest(
                            rawPayload.getBytes(
                                    StandardCharsets.UTF_8
                            )
                    );

            return HexFormat
                    .of()
                    .formatHex(
                            hash
                    );
        } catch (
                NoSuchAlgorithmException ex
        ) {
            throw new IllegalStateException(
                    "SHA-256 không khả dụng.",
                    ex
            );
        }
    }

    private static String cleanRequired(
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

    private static String cleanOptional(
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

        if (clean.length() <= max) {
            return clean;
        }

        return clean.substring(
                0,
                max
        );
    }

    private static String normalizeStatus(
            String value
    ) {
        return String.valueOf(
                        value == null
                                ? ""
                                : value
                )
                .trim()
                .toUpperCase(
                        Locale.ROOT
                );
    }

    private static void requirePositiveId(
            long id,
            String label
    ) {
        if (id <= 0) {
            throw new IllegalArgumentException(
                    label + " không hợp lệ."
            );
        }
    }

    private static Long nullableLong(
            Object value
    ) {
        return value == null
                ? null
                : ((Number) value)
                .longValue();
    }

    private static Instant toInstant(
            Timestamp value
    ) {
        return value == null
                ? null
                : value.toInstant();
    }
}
