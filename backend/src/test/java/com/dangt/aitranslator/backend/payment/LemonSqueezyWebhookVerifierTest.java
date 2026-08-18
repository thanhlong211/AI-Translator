package com.dangt.aitranslator.backend.payment;

import com.dangt.aitranslator.backend.common.UnauthorizedException;
import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LemonSqueezyWebhookVerifierTest {

    private static final String SECRET =
            "unit-test-signing-secret";

    @Test
    void acceptsValidSignature()
            throws Exception {
        LemonSqueezyWebhookVerifier verifier =
                new LemonSqueezyWebhookVerifier(
                        SECRET
                );

        byte[] body =
                "{\"hello\":\"world\"}"
                        .getBytes(
                                StandardCharsets.UTF_8
                        );

        assertThatCode(
                () -> verifier.verify(
                        body,
                        sign(body)
                )
        ).doesNotThrowAnyException();
    }

    @Test
    void rejectsInvalidSignature() {
        LemonSqueezyWebhookVerifier verifier =
                new LemonSqueezyWebhookVerifier(
                        SECRET
                );

        byte[] body =
                "{\"hello\":\"world\"}"
                        .getBytes(
                                StandardCharsets.UTF_8
                        );

        assertThatThrownBy(
                () -> verifier.verify(
                        body,
                        "deadbeef"
                )
        ).isInstanceOf(
                UnauthorizedException.class
        );
    }

    private static String sign(
            byte[] body
    ) throws Exception {
        Mac mac =
                Mac.getInstance(
                        "HmacSHA256"
                );

        mac.init(
                new SecretKeySpec(
                        SECRET.getBytes(
                                StandardCharsets.UTF_8
                        ),
                        "HmacSHA256"
                )
        );

        return HexFormat.of()
                .formatHex(
                        mac.doFinal(body)
                );
    }
}
