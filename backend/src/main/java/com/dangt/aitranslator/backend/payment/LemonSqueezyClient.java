package com.dangt.aitranslator.backend.payment;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class LemonSqueezyClient {

    private static final MediaType JSON_API =
            MediaType.parseMediaType(
                    "application/vnd.api+json"
            );

    private final boolean enabled;
    private final String apiKey;
    private final String storeId;
    private final RestClient restClient;

    public LemonSqueezyClient(
            @Value("${app.payment.lemonsqueezy.enabled:false}")
            boolean enabled,
            @Value("${app.payment.lemonsqueezy.api-base-url:https://api.lemonsqueezy.com}")
            String apiBaseUrl,
            @Value("${app.payment.lemonsqueezy.api-key:}")
            String apiKey,
            @Value("${app.payment.lemonsqueezy.store-id:}")
            String storeId
    ) {
        this.enabled = enabled;
        this.apiKey = clean(apiKey);
        this.storeId = clean(storeId);

        String baseUrl = clean(apiBaseUrl);

        if (baseUrl.isBlank()) {
            baseUrl =
                    "https://api.lemonsqueezy.com";
        }

        while (baseUrl.endsWith("/")) {
            baseUrl =
                    baseUrl.substring(
                            0,
                            baseUrl.length() - 1
                    );
        }

        this.restClient =
                RestClient.builder()
                        .baseUrl(baseUrl)
                        .build();
    }

    public LemonSqueezyCheckout createCheckout(
            String variantId,
            String transactionPublicId,
            long userId
    ) {
        requireConfigured();

        String cleanVariantId =
                require(
                        variantId,
                        "Lemon Squeezy Variant ID"
                );

        String cleanTransactionId =
                require(
                        transactionPublicId,
                        "Transaction ID"
                );

        if (userId <= 0) {
            throw new IllegalArgumentException(
                    "User ID không hợp lệ."
            );
        }

        Map<String, Object> custom =
                new LinkedHashMap<>();

        custom.put(
                "transaction_public_id",
                cleanTransactionId
        );

        custom.put(
                "user_id",
                Long.toString(userId)
        );

        Map<String, Object> checkoutData =
                new LinkedHashMap<>();

        checkoutData.put(
                "custom",
                custom
        );

        Map<String, Object> attributes =
                new LinkedHashMap<>();

        attributes.put(
                "checkout_data",
                checkoutData
        );

        Map<String, Object> storeData =
                Map.of(
                        "type",
                        "stores",
                        "id",
                        storeId
                );

        Map<String, Object> variantData =
                Map.of(
                        "type",
                        "variants",
                        "id",
                        cleanVariantId
                );

        Map<String, Object> relationships =
                new LinkedHashMap<>();

        relationships.put(
                "store",
                Map.of(
                        "data",
                        storeData
                )
        );

        relationships.put(
                "variant",
                Map.of(
                        "data",
                        variantData
                )
        );

        Map<String, Object> data =
                new LinkedHashMap<>();

        data.put(
                "type",
                "checkouts"
        );

        data.put(
                "attributes",
                attributes
        );

        data.put(
                "relationships",
                relationships
        );

        Map<String, Object> payload =
                Map.of(
                        "data",
                        data
                );

        Map<?, ?> response;

        try {
            response =
                    restClient
                            .post()
                            .uri("/v1/checkouts")
                            .header(
                                    "Authorization",
                                    "Bearer " + apiKey
                            )
                            .accept(JSON_API)
                            .contentType(JSON_API)
                            .body(payload)
                            .retrieve()
                            .body(Map.class);
        } catch (
                RestClientResponseException ex
        ) {
            throw new IllegalStateException(
                    "Lemon Squeezy checkout lỗi HTTP "
                            + ex.getStatusCode()
                            + ": "
                            + safeBody(
                                    ex.getResponseBodyAsString()
                            ),
                    ex
            );
        } catch (Exception ex) {
            throw new IllegalStateException(
                    "Không kết nối được Lemon Squeezy.",
                    ex
            );
        }

        if (response == null) {
            throw new IllegalStateException(
                    "Lemon Squeezy trả response rỗng."
            );
        }

        Map<?, ?> responseData =
                requireMap(
                        response.get("data"),
                        "data"
                );

        Map<?, ?> responseAttributes =
                requireMap(
                        responseData.get(
                                "attributes"
                        ),
                        "data.attributes"
                );

        String checkoutId =
                require(
                        responseData.get("id"),
                        "Checkout ID"
                );

        String checkoutUrl =
                require(
                        responseAttributes.get(
                                "url"
                        ),
                        "Checkout URL"
                );

        validateCheckoutUrl(
                checkoutUrl
        );

        return new LemonSqueezyCheckout(
                checkoutId,
                checkoutUrl
        );
    }

    private void requireConfigured() {
        if (!enabled) {
            throw new IllegalStateException(
                    "Lemon Squeezy checkout chưa được bật."
            );
        }

        if (apiKey.isBlank()) {
            throw new IllegalStateException(
                    "LEMON_SQUEEZY_API_KEY chưa được cấu hình."
            );
        }

        if (storeId.isBlank()) {
            throw new IllegalStateException(
                    "LEMON_SQUEEZY_STORE_ID chưa được cấu hình."
            );
        }
    }

    private static void validateCheckoutUrl(
            String value
    ) {
        try {
            URI uri =
                    URI.create(value);

            if (
                    !"https".equalsIgnoreCase(
                            uri.getScheme()
                    )
                            || uri.getHost() == null
                            || uri.getHost()
                            .isBlank()
                            || uri.getUserInfo()
                            != null
            ) {
                throw new IllegalArgumentException(
                        "unsafe checkout URL"
                );
            }
        } catch (Exception ex) {
            throw new IllegalStateException(
                    "Lemon Squeezy trả checkout URL không hợp lệ.",
                    ex
            );
        }
    }

    private static Map<?, ?> requireMap(
            Object value,
            String name
    ) {
        if (value instanceof Map<?, ?> map) {
            return map;
        }

        throw new IllegalStateException(
                "Lemon Squeezy response thiếu "
                        + name
                        + "."
        );
    }

    private static String require(
            Object value,
            String name
    ) {
        String clean =
                clean(
                        value == null
                                ? ""
                                : String.valueOf(
                                value
                        )
                );

        if (clean.isBlank()) {
            throw new IllegalStateException(
                    name + " bị thiếu."
            );
        }

        return clean;
    }

    private static String clean(
            String value
    ) {
        return value == null
                ? ""
                : value.trim();
    }

    private static String safeBody(
            String body
    ) {
        String clean =
                String.valueOf(
                                body == null
                                        ? ""
                                        : body
                        )
                        .replaceAll(
                                "[\\r\\n]+",
                                " "
                        )
                        .trim();

        return clean.length() <= 500
                ? clean
                : clean.substring(
                0,
                500
        );
    }
}
