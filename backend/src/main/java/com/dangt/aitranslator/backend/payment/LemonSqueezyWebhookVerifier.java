package com.dangt.aitranslator.backend.payment;

import com.dangt.aitranslator.backend.common.UnauthorizedException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Locale;

@Service
public class LemonSqueezyWebhookVerifier {

    private final String webhookSecret;

    public LemonSqueezyWebhookVerifier(
            @Value("${app.payment.lemonsqueezy.webhook-secret:}")
            String webhookSecret
    ) {
        this.webhookSecret =
                clean(webhookSecret);
    }

    public void verify(
            byte[] rawBody,
            String signature
    ) {
        if (webhookSecret.isBlank()) {
            throw new IllegalStateException(
                    "LEMON_SQUEEZY_WEBHOOK_SECRET chưa được cấu hình."
            );
        }

        if (
                rawBody == null
                        || rawBody.length == 0
        ) {
            throw new UnauthorizedException(
                    "Webhook payload không hợp lệ."
            );
        }

        String cleanSignature =
                clean(signature)
                        .toLowerCase(
                                Locale.ROOT
                        );

        if (cleanSignature.isBlank()) {
            throw new UnauthorizedException(
                    "Webhook signature bị thiếu."
            );
        }

        byte[] expected;

        try {
            Mac mac =
                    Mac.getInstance(
                            "HmacSHA256"
                    );

            mac.init(
                    new SecretKeySpec(
                            webhookSecret.getBytes(
                                    StandardCharsets.UTF_8
                            ),
                            "HmacSHA256"
                    )
            );

            String digest =
                    HexFormat.of()
                            .formatHex(
                                    mac.doFinal(
                                            rawBody
                                    )
                            );

            expected =
                    digest.getBytes(
                            StandardCharsets.US_ASCII
                    );
        } catch (Exception ex) {
            throw new IllegalStateException(
                    "Không thể verify Lemon Squeezy webhook.",
                    ex
            );
        }

        byte[] actual =
                cleanSignature.getBytes(
                        StandardCharsets.US_ASCII
                );

        if (
                !MessageDigest.isEqual(
                        expected,
                        actual
                )
        ) {
            throw new UnauthorizedException(
                    "Webhook signature không hợp lệ."
            );
        }
    }

    private static String clean(
            String value
    ) {
        return value == null
                ? ""
                : value.trim();
    }
}
