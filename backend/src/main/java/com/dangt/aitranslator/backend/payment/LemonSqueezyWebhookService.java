package com.dangt.aitranslator.backend.payment;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.HexFormat;
import java.util.Locale;

@Service
public class LemonSqueezyWebhookService {

    private final LemonSqueezyWebhookVerifier verifier;
    private final PaymentWebhookEventService
            webhookEventService;
    private final PaymentTransactionService
            paymentTransactionService;
    private final LemonSqueezyPriceMappingService
            priceMappingService;
    private final JsonMapper jsonMapper;
    private final String storeId;

    public LemonSqueezyWebhookService(
            LemonSqueezyWebhookVerifier verifier,
            PaymentWebhookEventService
                    webhookEventService,
            PaymentTransactionService
                    paymentTransactionService,
            LemonSqueezyPriceMappingService
                    priceMappingService,
            JsonMapper jsonMapper,
            @Value("${app.payment.lemonsqueezy.store-id:}")
            String storeId
    ) {
        this.verifier =
                verifier;
        this.webhookEventService =
                webhookEventService;
        this.paymentTransactionService =
                paymentTransactionService;
        this.priceMappingService =
                priceMappingService;
        this.jsonMapper =
                jsonMapper;
        this.storeId =
                clean(storeId);
    }

    public LemonSqueezyWebhookResponse handle(
            byte[] rawBody,
            String signature,
            String headerEventName
    ) {
        /*
         * CRITICAL:
         * Verify exact raw bytes before parsing/persisting.
         */
        verifier.verify(
                rawBody,
                signature
        );

        JsonNode root =
                parse(
                        rawBody
                );

        String eventType =
                requiredText(
                        root.path("meta")
                                .path("event_name"),
                        "meta.event_name"
                );

        String headerEvent =
                clean(
                        headerEventName
                );

        if (
                headerEvent.isBlank()
                        || !headerEvent.equals(
                        eventType
                )
        ) {
            throw new IllegalArgumentException(
                    "X-Event-Name không khớp webhook payload."
            );
        }

        validateStore(
                root
        );

        String rawPayload =
                new String(
                        rawBody,
                        StandardCharsets.UTF_8
                );

        /*
         * Lemon does not expose a dedicated webhook-delivery ID
         * in the documented headers, so derive a stable ID from
         * event type + exact signed payload.
         */
        String providerEventId =
                providerEventId(
                        eventType,
                        rawBody
                );

        PaymentWebhookClaim claim =
                webhookEventService.claim(
                        PaymentProvider
                                .LEMON_SQUEEZY,
                        providerEventId,
                        eventType,
                        rawPayload
                );

        if (!claim.claimed()) {
            return new LemonSqueezyWebhookResponse(
                    true,
                    true,
                    eventType
            );
        }

        long ledgerEventId =
                claim.event().id();

        try {
            Long transactionId =
                    processEvent(
                            eventType,
                            root
                    );

            webhookEventService
                    .markProcessed(
                            ledgerEventId,
                            transactionId
                    );

            return new LemonSqueezyWebhookResponse(
                    true,
                    false,
                    eventType
            );
        } catch (RuntimeException ex) {
            try {
                webhookEventService
                        .markFailed(
                                ledgerEventId,
                                safeFailure(ex)
                        );
            } catch (RuntimeException ledgerEx) {
                ex.addSuppressed(
                        ledgerEx
                );
            }

            throw ex;
        }
    }

    private Long processEvent(
            String eventType,
            JsonNode root
    ) {
        return switch (eventType) {
            case "order_created" ->
                    processOrderCreated(
                            root
                    );

            case "subscription_created" ->
                    processSubscriptionCreated(
                            root
                    );

            case "order_refunded" ->
                    processOrderRefunded(
                            root
                    );

            default ->
                    resolveLinkedTransactionId(
                            root
                    );
        };
    }

    private Long processOrderCreated(
            JsonNode root
    ) {
        JsonNode data =
                requireResource(
                        root,
                        "orders",
                        "order_created"
                );

        LinkedPayment linked =
                linkedPayment(
                        root
                );

        if (linked == null) {
            return null;
        }

        PaymentTransaction transaction =
                linked.transaction();

        requireLemonTransaction(
                transaction
        );

        JsonNode attributes =
                data.path(
                        "attributes"
                );

        String orderStatus =
                requiredText(
                        attributes.path(
                                "status"
                        ),
                        "data.attributes.status"
                );

        if (
                !"paid".equalsIgnoreCase(
                        orderStatus
                )
        ) {
            throw new IllegalStateException(
                    "Lemon Squeezy order chưa ở trạng thái paid."
            );
        }

        String currency =
                requiredText(
                        attributes.path(
                                "currency"
                        ),
                        "data.attributes.currency"
                );

        if (
                transaction.currency() == null
                        || !transaction.currency()
                        .equalsIgnoreCase(
                                currency
                        )
        ) {
            throw new IllegalStateException(
                    "Currency webhook không khớp payment transaction."
            );
        }

        BigDecimal subtotal =
                requiredDecimal(
                        attributes.path(
                                "subtotal"
                        ),
                        "data.attributes.subtotal"
                );

        if (
                subtotal.compareTo(
                        BigDecimal.valueOf(
                                transaction.amountMinor()
                        )
                ) != 0
        ) {
            throw new IllegalStateException(
                    "Số tiền Lemon Squeezy không khớp payment transaction."
            );
        }

        BigDecimal setupFee =
                optionalDecimal(
                        attributes.path(
                                "setup_fee"
                        )
                );

        if (
                setupFee != null
                        && setupFee.signum() != 0
        ) {
            throw new IllegalStateException(
                    "Setup fee chưa được hỗ trợ trong payment flow."
            );
        }

        BigDecimal discountTotal =
                optionalDecimal(
                        attributes.path(
                                "discount_total"
                        )
                );

        if (
                discountTotal != null
                        && discountTotal.signum() != 0
        ) {
            throw new IllegalStateException(
                    "Discount chưa được hỗ trợ trong payment flow."
            );
        }

        String actualVariantId =
                requiredText(
                        attributes.path(
                                "first_order_item"
                        ).path(
                                "variant_id"
                        ),
                        "first_order_item.variant_id"
                );

        String expectedVariantId =
                priceMappingService
                        .requireVariantId(
                                transaction.priceId()
                        );

        if (
                !expectedVariantId.equals(
                        actualVariantId
                )
        ) {
            throw new IllegalStateException(
                    "Variant webhook không khớp payment transaction."
            );
        }

        String orderId =
                requiredText(
                        data.path("id"),
                        "data.id"
                );

        String customerId =
                requiredText(
                        attributes.path(
                                "customer_id"
                        ),
                        "data.attributes.customer_id"
                );

        Instant createdAt =
                optionalInstant(
                        attributes.path(
                                "created_at"
                        )
                );

        PaymentTransaction attached =
                paymentTransactionService
                        .attachProviderReferences(
                                linked.publicId(),
                                orderId,
                                customerId,
                                null
                        );

        PaymentTransaction updated =
                paymentTransactionService
                        .markSucceeded(
                                linked.publicId(),
                                orderId,
                                customerId,
                                attached
                                        .providerSubscriptionReference(),
                                createdAt
                        );

        return updated.id();
    }

    private Long processSubscriptionCreated(
            JsonNode root
    ) {
        JsonNode data =
                requireResource(
                        root,
                        "subscriptions",
                        "subscription_created"
                );

        LinkedPayment linked =
                linkedPayment(
                        root
                );

        if (linked == null) {
            return null;
        }

        PaymentTransaction transaction =
                linked.transaction();

        requireLemonTransaction(
                transaction
        );

        JsonNode attributes =
                data.path(
                        "attributes"
                );

        String actualVariantId =
                requiredText(
                        attributes.path(
                                "variant_id"
                        ),
                        "data.attributes.variant_id"
                );

        String expectedVariantId =
                priceMappingService
                        .requireVariantId(
                                transaction.priceId()
                        );

        if (
                !expectedVariantId.equals(
                        actualVariantId
                )
        ) {
            throw new IllegalStateException(
                    "Subscription Variant ID không khớp payment transaction."
            );
        }

        String subscriptionId =
                requiredText(
                        data.path("id"),
                        "data.id"
                );

        String orderId =
                requiredText(
                        attributes.path(
                                "order_id"
                        ),
                        "data.attributes.order_id"
                );

        String customerId =
                requiredText(
                        attributes.path(
                                "customer_id"
                        ),
                        "data.attributes.customer_id"
                );

        PaymentTransaction updated =
                paymentTransactionService
                        .attachProviderReferences(
                                linked.publicId(),
                                orderId,
                                customerId,
                                subscriptionId
                        );

        /*
         * Do NOT activate here.
         *
         * Only order_created activates after price/currency/
         * variant/status validation.
         */
        return updated.id();
    }

    private Long processOrderRefunded(
            JsonNode root
    ) {
        JsonNode data =
                requireResource(
                        root,
                        "orders",
                        "order_refunded"
                );

        LinkedPayment linked =
                linkedPayment(
                        root
                );

        if (linked == null) {
            return null;
        }

        PaymentTransaction transaction =
                linked.transaction();

        requireLemonTransaction(
                transaction
        );

        String orderId =
                requiredText(
                        data.path("id"),
                        "data.id"
                );

        if (
                transaction.providerReference()
                        != null
                        && !transaction
                        .providerReference()
                        .equals(orderId)
        ) {
            throw new IllegalStateException(
                    "Refund order không khớp payment transaction."
            );
        }

        JsonNode attributes =
                data.path(
                        "attributes"
                );

        String currency =
                requiredText(
                        attributes.path(
                                "currency"
                        ),
                        "data.attributes.currency"
                );

        if (
                transaction.currency() == null
                        || !transaction.currency()
                        .equalsIgnoreCase(
                                currency
                        )
        ) {
            throw new IllegalStateException(
                    "Refund currency không khớp payment transaction."
            );
        }

        boolean fullyRefunded =
                attributes.path(
                        "refunded"
                ).asBoolean(false);

        if (!fullyRefunded) {
            /*
             * Do not silently mark a partial refund as processed:
             * current transaction model's markRefunded() represents
             * a full refund and entitlement revocation.
             */
            throw new IllegalStateException(
                    "Partial refund chưa được hỗ trợ tự động."
            );
        }

        PaymentTransaction updated =
                paymentTransactionService
                        .markRefunded(
                                linked.publicId()
                        );

        return updated.id();
    }

    private Long resolveLinkedTransactionId(
            JsonNode root
    ) {
        LinkedPayment linked =
                linkedPayment(
                        root
                );

        return linked == null
                ? null
                : linked.transaction().id();
    }

    private LinkedPayment linkedPayment(
            JsonNode root
    ) {
        JsonNode custom =
                root.path("meta")
                        .path(
                                "custom_data"
                        );

        String publicId =
                optionalText(
                        custom.path(
                                "transaction_public_id"
                        )
                );

        if (
                publicId == null
                        || publicId.isBlank()
        ) {
            return null;
        }

        Long expectedUserId =
                optionalLong(
                        custom.path(
                                "user_id"
                        )
                );

        if (expectedUserId == null) {
            throw new IllegalStateException(
                    "Webhook transaction có transaction_public_id nhưng thiếu user_id."
            );
        }

        PaymentTransaction transaction =
                paymentTransactionService
                        .findByPublicId(
                                publicId
                        );

        if (
                transaction.userId()
                        != expectedUserId
        ) {
            throw new IllegalStateException(
                    "Webhook user_id không khớp payment transaction."
            );
        }

        return new LinkedPayment(
                publicId,
                transaction
        );
    }

    private void requireLemonTransaction(
            PaymentTransaction transaction
    ) {
        if (
                transaction == null
                        || transaction.provider()
                        != PaymentProvider
                        .LEMON_SQUEEZY
        ) {
            throw new IllegalStateException(
                    "Payment transaction không thuộc Lemon Squeezy."
            );
        }

        if (
                transaction.priceId() == null
                        || transaction.priceId()
                        <= 0
        ) {
            throw new IllegalStateException(
                    "Payment transaction thiếu price_id."
            );
        }
    }

    private JsonNode requireResource(
            JsonNode root,
            String expectedType,
            String eventType
    ) {
        JsonNode data =
                root.path("data");

        String actualType =
                requiredText(
                        data.path("type"),
                        "data.type"
                );

        if (
                !expectedType.equals(
                        actualType
                )
        ) {
            throw new IllegalArgumentException(
                    eventType
                            + " không chứa resource "
                            + expectedType
                            + "."
            );
        }

        return data;
    }

    private void validateStore(
            JsonNode root
    ) {
        if (storeId.isBlank()) {
            throw new IllegalStateException(
                    "LEMON_SQUEEZY_STORE_ID chưa được cấu hình."
            );
        }

        String payloadStoreId =
                requiredText(
                        root.path("data")
                                .path("attributes")
                                .path("store_id"),
                        "data.attributes.store_id"
                );

        if (
                !storeId.equals(
                        payloadStoreId
                )
        ) {
            throw new IllegalArgumentException(
                    "Webhook không thuộc Lemon Squeezy store đã cấu hình."
            );
        }
    }

    private JsonNode parse(
            byte[] rawBody
    ) {
        try {
            JsonNode root =
                    jsonMapper.readTree(
                            rawBody
                    );

            if (
                    root == null
                            || !root.isObject()
            ) {
                throw new IllegalArgumentException(
                        "Webhook JSON không hợp lệ."
                );
            }

            return root;
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalArgumentException(
                    "Webhook JSON không hợp lệ.",
                    ex
            );
        }
    }

    private static String providerEventId(
            String eventType,
            byte[] rawBody
    ) {
        try {
            MessageDigest digest =
                    MessageDigest.getInstance(
                            "SHA-256"
                    );

            digest.update(
                    eventType.getBytes(
                            StandardCharsets.UTF_8
                    )
            );

            digest.update(
                    (byte) '\n'
            );

            digest.update(
                    rawBody
            );

            return "ls_"
                    + HexFormat.of()
                    .formatHex(
                            digest.digest()
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

    private static String requiredText(
            JsonNode node,
            String label
    ) {
        String value =
                optionalText(
                        node
                );

        if (
                value == null
                        || value.isBlank()
        ) {
            throw new IllegalArgumentException(
                    label + " là bắt buộc."
            );
        }

        return value;
    }

    private static String optionalText(
            JsonNode node
    ) {
        if (
                node == null
                        || node.isMissingNode()
                        || node.isNull()
                        || node.isContainer()
        ) {
            return null;
        }

        String value =
                node.asText()
                        .trim();

        return value.isBlank()
                ? null
                : value;
    }

    private static Long optionalLong(
            JsonNode node
    ) {
        String value =
                optionalText(
                        node
                );

        if (value == null) {
            return null;
        }

        try {
            return Long.valueOf(
                    value
            );
        } catch (
                NumberFormatException ex
        ) {
            throw new IllegalArgumentException(
                    "Webhook numeric value không hợp lệ.",
                    ex
            );
        }
    }

    private static BigDecimal requiredDecimal(
            JsonNode node,
            String label
    ) {
        BigDecimal value =
                optionalDecimal(
                        node
                );

        if (value == null) {
            throw new IllegalArgumentException(
                    label + " là bắt buộc."
            );
        }

        return value;
    }

    private static BigDecimal optionalDecimal(
            JsonNode node
    ) {
        String value =
                optionalText(
                        node
                );

        if (value == null) {
            return null;
        }

        try {
            return new BigDecimal(
                    value
            );
        } catch (
                NumberFormatException ex
        ) {
            throw new IllegalArgumentException(
                    "Webhook amount không hợp lệ.",
                    ex
            );
        }
    }

    private static Instant optionalInstant(
            JsonNode node
    ) {
        String value =
                optionalText(
                        node
                );

        if (value == null) {
            return null;
        }

        try {
            return Instant.parse(
                    value
            );
        } catch (
                DateTimeParseException ex
        ) {
            throw new IllegalArgumentException(
                    "Webhook timestamp không hợp lệ.",
                    ex
            );
        }
    }

    private static String safeFailure(
            Throwable error
    ) {
        String message =
                clean(
                        error == null
                                ? ""
                                : error.getMessage()
                );

        if (message.isBlank()) {
            message =
                    error == null
                            ? "Webhook processing failed."
                            : error.getClass()
                            .getSimpleName();
        }

        return message.length() <= 500
                ? message
                : message.substring(
                        0,
                        500
                );
    }

    private static String clean(
            String value
    ) {
        return value == null
                ? ""
                : value.trim();
    }

    private record LinkedPayment(
            String publicId,
            PaymentTransaction transaction
    ) {
    }
}
