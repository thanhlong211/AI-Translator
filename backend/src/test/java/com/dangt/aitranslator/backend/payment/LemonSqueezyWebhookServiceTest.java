package com.dangt.aitranslator.backend.payment;

import tools.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LemonSqueezyWebhookServiceTest {

    @Test
    void orderCreatedActivatesAfterValidation() {
        Fixture f =
                fixture(
                        "order_created",
                        false
                );

        PaymentTransaction transaction =
                transaction();

        when(
                f.transactions.findByPublicId(
                        "AIT-TX-1"
                )
        ).thenReturn(
                transaction
        );

        when(
                f.mapping.requireVariantId(
                        3L
                )
        ).thenReturn(
                "555"
        );

        when(
                f.transactions.attachProviderReferences(
                        "AIT-TX-1",
                        "77",
                        "88",
                        null
                )
        ).thenReturn(
                transaction
        );

        when(
                f.transactions.markSucceeded(
                        eq("AIT-TX-1"),
                        eq("77"),
                        eq("88"),
                        eq(null),
                        eq(
                                Instant.parse(
                                        "2026-08-18T12:00:00Z"
                                )
                        )
                )
        ).thenReturn(
                transaction
        );

        LemonSqueezyWebhookResponse response =
                f.service.handle(
                        orderPayload(
                                999,
                                "USD",
                                "555"
                        ).getBytes(
                                StandardCharsets.UTF_8
                        ),
                        "signature",
                        "order_created"
                );

        assertThat(
                response.received()
        ).isTrue();

        assertThat(
                response.duplicate()
        ).isFalse();

        verify(
                f.transactions
        ).markSucceeded(
                eq("AIT-TX-1"),
                eq("77"),
                eq("88"),
                eq(null),
                eq(
                        Instant.parse(
                                "2026-08-18T12:00:00Z"
                        )
                )
        );

        verify(
                f.ledger
        ).markProcessed(
                5L,
                99L
        );
    }

    @Test
    void subscriptionCreatedOnlyAttachesReferences() {
        Fixture f =
                fixture(
                        "subscription_created",
                        false
                );

        PaymentTransaction transaction =
                transaction();

        when(
                f.transactions.findByPublicId(
                        "AIT-TX-1"
                )
        ).thenReturn(
                transaction
        );

        when(
                f.mapping.requireVariantId(
                        3L
                )
        ).thenReturn(
                "555"
        );

        when(
                f.transactions.attachProviderReferences(
                        "AIT-TX-1",
                        "77",
                        "88",
                        "123"
                )
        ).thenReturn(
                transaction
        );

        String payload =
                """
                {
                  "meta": {
                    "event_name": "subscription_created",
                    "custom_data": {
                      "transaction_public_id": "AIT-TX-1",
                      "user_id": "42"
                    }
                  },
                  "data": {
                    "type": "subscriptions",
                    "id": "123",
                    "attributes": {
                      "store_id": 454829,
                      "customer_id": 88,
                      "order_id": 77,
                      "variant_id": 555,
                      "status": "active"
                    }
                  }
                }
                """;

        LemonSqueezyWebhookResponse response =
                f.service.handle(
                        payload.getBytes(
                                StandardCharsets.UTF_8
                        ),
                        "signature",
                        "subscription_created"
                );

        assertThat(
                response.received()
        ).isTrue();

        verify(
                f.transactions
        ).attachProviderReferences(
                "AIT-TX-1",
                "77",
                "88",
                "123"
        );

        verify(
                f.transactions,
                never()
        ).markSucceeded(
                anyString(),
                any(),
                any(),
                any(),
                any()
        );
    }

    @Test
    void duplicateDoesNotProcessPayment() {
        Fixture f =
                fixture(
                        "order_created",
                        true
                );

        LemonSqueezyWebhookResponse response =
                f.service.handle(
                        orderPayload(
                                999,
                                "USD",
                                "555"
                        ).getBytes(
                                StandardCharsets.UTF_8
                        ),
                        "signature",
                        "order_created"
                );

        assertThat(
                response.duplicate()
        ).isTrue();

        verify(
                f.transactions,
                never()
        ).findByPublicId(
                anyString()
        );
    }

    @Test
    void amountMismatchFailsLedger() {
        Fixture f =
                fixture(
                        "order_created",
                        false
                );

        PaymentTransaction transaction =
                transaction();

        when(
                f.transactions.findByPublicId(
                        "AIT-TX-1"
                )
        ).thenReturn(
                transaction
        );

        when(
                f.mapping.requireVariantId(
                        3L
                )
        ).thenReturn(
                "555"
        );

        assertThatThrownBy(
                () -> f.service.handle(
                        orderPayload(
                                998,
                                "USD",
                                "555"
                        ).getBytes(
                                StandardCharsets.UTF_8
                        ),
                        "signature",
                        "order_created"
                )
        ).isInstanceOf(
                IllegalStateException.class
        );

        verify(
                f.ledger
        ).markFailed(
                eq(5L),
                anyString()
        );

        verify(
                f.transactions,
                never()
        ).markSucceeded(
                anyString(),
                any(),
                any(),
                any(),
                any()
        );
    }

    private Fixture fixture(
            String eventType,
            boolean duplicate
    ) {
        LemonSqueezyWebhookVerifier verifier =
                mock(
                        LemonSqueezyWebhookVerifier.class
                );

        PaymentWebhookEventService ledger =
                mock(
                        PaymentWebhookEventService.class
                );

        PaymentTransactionService transactions =
                mock(
                        PaymentTransactionService.class
                );

        LemonSqueezyPriceMappingService mapping =
                mock(
                        LemonSqueezyPriceMappingService.class
                );

        LemonSqueezyWebhookService service =
                new LemonSqueezyWebhookService(
                        verifier,
                        ledger,
                        transactions,
                        mapping,
                        JsonMapper.builder().build(),
                        "454829"
                );

        PaymentWebhookClaim claim =
                duplicate
                        ? PaymentWebhookClaim
                        .duplicate(
                                event(eventType)
                        )
                        : PaymentWebhookClaim
                        .claimed(
                                event(eventType)
                        );

        when(
                ledger.claim(
                        eq(
                                PaymentProvider
                                        .LEMON_SQUEEZY
                        ),
                        anyString(),
                        eq(eventType),
                        anyString()
                )
        ).thenReturn(
                claim
        );

        return new Fixture(
                service,
                ledger,
                transactions,
                mapping
        );
    }

    private PaymentTransaction transaction() {
        PaymentTransaction transaction =
                mock(
                        PaymentTransaction.class
                );

        when(
                transaction.id()
        ).thenReturn(
                99L
        );

        when(
                transaction.userId()
        ).thenReturn(
                42L
        );

        when(
                transaction.priceId()
        ).thenReturn(
                3L
        );

        when(
                transaction.currency()
        ).thenReturn(
                "USD"
        );

        when(
                transaction.amountMinor()
        ).thenReturn(
                999L
        );

        when(
                transaction.provider()
        ).thenReturn(
                PaymentProvider
                        .LEMON_SQUEEZY
        );

        when(
                transaction.status()
        ).thenReturn(
                PaymentStatus.PENDING
        );

        return transaction;
    }

    private PaymentWebhookEvent event(
            String eventType
    ) {
        return new PaymentWebhookEvent(
                5L,
                PaymentProvider.LEMON_SQUEEZY,
                "test-event",
                eventType,
                null,
                "hash",
                "PROCESSING",
                null,
                Instant.now(),
                null
        );
    }

    private String orderPayload(
            long subtotal,
            String currency,
            String variantId
    ) {
        return """
                {
                  "meta": {
                    "event_name": "order_created",
                    "custom_data": {
                      "transaction_public_id": "AIT-TX-1",
                      "user_id": "42"
                    }
                  },
                  "data": {
                    "type": "orders",
                    "id": "77",
                    "attributes": {
                      "store_id": 454829,
                      "customer_id": 88,
                      "currency": "%s",
                      "subtotal": %d,
                      "setup_fee": 0,
                      "discount_total": 0,
                      "tax": 0,
                      "total": %d,
                      "status": "paid",
                      "refunded": false,
                      "first_order_item": {
                        "variant_id": %s
                      },
                      "created_at": "2026-08-18T12:00:00Z"
                    }
                  }
                }
                """.formatted(
                currency,
                subtotal,
                subtotal,
                variantId
        );
    }

    private record Fixture(
            LemonSqueezyWebhookService service,
            PaymentWebhookEventService ledger,
            PaymentTransactionService transactions,
            LemonSqueezyPriceMappingService mapping
    ) {
    }
}
