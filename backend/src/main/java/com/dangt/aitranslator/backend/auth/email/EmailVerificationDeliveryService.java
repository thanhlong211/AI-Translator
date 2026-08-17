package com.dangt.aitranslator.backend.auth.email;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;

@Service
public class EmailVerificationDeliveryService {

    private static final Logger log =
            LoggerFactory.getLogger(
                    EmailVerificationDeliveryService.class
            );

    private static final HttpClient HTTP_CLIENT =
            HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(5))
                    .build();

    private final ObjectProvider<JavaMailSender>
            mailSenderProvider;

    private final String deliveryMode;
    private final String mailFrom;
    private final String resendApiUrl;
    private final String resendApiKey;
    private final int ttlMinutes;

    public EmailVerificationDeliveryService(
            ObjectProvider<JavaMailSender> mailSenderProvider,

            @Value("${app.email-verification.delivery:LOG}")
            String deliveryMode,

            @Value("${app.email-verification.mail-from:no-reply@localhost}")
            String mailFrom,

            @Value("${app.email-verification.resend-api-url:https://api.resend.com/emails}")
            String resendApiUrl,

            @Value("${app.email-verification.resend-api-key:}")
            String resendApiKey,

            @Value("${app.email-verification.ttl-minutes:10}")
            int ttlMinutes
    ) {
        this.mailSenderProvider = mailSenderProvider;

        this.deliveryMode =
                String.valueOf(deliveryMode)
                        .trim()
                        .toUpperCase(Locale.ROOT);

        this.mailFrom =
                String.valueOf(mailFrom).trim();

        this.resendApiUrl =
                String.valueOf(resendApiUrl).trim();

        this.resendApiKey =
                String.valueOf(resendApiKey).trim();

        this.ttlMinutes =
                Math.max(
                        5,
                        Math.min(ttlMinutes, 30)
                );
    }

    public void deliver(
            String email,
            String code
    ) {
        if ("LOG".equals(deliveryMode)) {
            log.warn(
                    "DEV EMAIL VERIFICATION for {} expires in {} minutes: {}",
                    maskEmail(email),
                    ttlMinutes,
                    code
            );
            return;
        }

        if ("RESEND".equals(deliveryMode)) {
            deliverWithResend(email, code);
            return;
        }

        if ("SMTP".equals(deliveryMode)) {
            deliverWithSmtp(email, code);
            return;
        }

        throw new IllegalStateException(
                "Unsupported email verification delivery mode: "
                        + deliveryMode
        );
    }

    private void deliverWithSmtp(
            String email,
            String code
    ) {
        JavaMailSender mailSender =
                mailSenderProvider.getIfAvailable();

        if (mailSender == null) {
            throw new IllegalStateException(
                    "SMTP email verification delivery is not available."
            );
        }

        SimpleMailMessage message =
                new SimpleMailMessage();

        message.setFrom(mailFrom);
        message.setTo(email);
        message.setSubject(
                "AitraNova - Verify your email"
        );
        message.setText(
                buildMessageText(code)
        );

        mailSender.send(message);
    }

    private void deliverWithResend(
            String email,
            String code
    ) {
        if (resendApiKey.isBlank()) {
            throw new IllegalStateException(
                    "RESEND_API_KEY is required for Resend delivery."
            );
        }

        if (resendApiUrl.isBlank()) {
            throw new IllegalStateException(
                    "RESEND_API_URL is required for Resend delivery."
            );
        }

        if (mailFrom.isBlank()) {
            throw new IllegalStateException(
                    "Email verification mail-from is required."
            );
        }

        String payload =
                "{"
                + "\"from\":" + jsonString(mailFrom) + ","
                + "\"to\":[" + jsonString(email) + "],"
                + "\"subject\":"
                + jsonString("AitraNova - Verify your email")
                + ","
                + "\"text\":"
                + jsonString(buildMessageText(code))
                + "}";

        HttpRequest request =
                HttpRequest.newBuilder(
                                URI.create(resendApiUrl)
                        )
                        .timeout(Duration.ofSeconds(12))
                        .header(
                                "Authorization",
                                "Bearer " + resendApiKey
                        )
                        .header(
                                "Content-Type",
                                "application/json"
                        )
                        .header(
                                "Accept",
                                "application/json"
                        )
                        .POST(
                                HttpRequest.BodyPublishers
                                        .ofString(
                                                payload,
                                                StandardCharsets.UTF_8
                                        )
                        )
                        .build();

        try {
            HttpResponse<String> response =
                    HTTP_CLIENT.send(
                            request,
                            HttpResponse.BodyHandlers
                                    .ofString(
                                            StandardCharsets.UTF_8
                                    )
                    );

            if (
                    response.statusCode() < 200
                    || response.statusCode() >= 300
            ) {
                throw new IllegalStateException(
                        "Resend API returned HTTP "
                                + response.statusCode()
                                + ": "
                                + safeResponseBody(
                                        response.body()
                                )
                );
            }
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();

            throw new IllegalStateException(
                    "Resend API request was interrupted.",
                    ex
            );
        } catch (Exception ex) {
            if (
                    ex instanceof
                    IllegalStateException stateException
            ) {
                throw stateException;
            }

            throw new IllegalStateException(
                    "Resend API request failed.",
                    ex
            );
        }
    }

    private String buildMessageText(
            String code
    ) {
        return """
                Verify your email address for your AitraNova account.

                Verification code:
                %s

                This code expires in %d minutes.

                If you did not create this account or request verification, you can ignore this message.
                """.formatted(
                code,
                ttlMinutes
        );
    }

    private String jsonString(
            String value
    ) {
        String clean =
                String.valueOf(
                        value == null
                                ? ""
                                : value
                );

        StringBuilder out =
                new StringBuilder(
                        clean.length() + 16
                );

        out.append('"');

        for (
                int i = 0;
                i < clean.length();
                i++
        ) {
            char ch = clean.charAt(i);

            switch (ch) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\b' -> out.append("\\b");
                case '\f' -> out.append("\\f");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");

                default -> {
                    if (ch < 0x20) {
                        out.append(
                                String.format(
                                        "\\u%04x",
                                        (int) ch
                                )
                        );
                    } else {
                        out.append(ch);
                    }
                }
            }
        }

        out.append('"');
        return out.toString();
    }

    private String safeResponseBody(
            String body
    ) {
        String clean =
                String.valueOf(
                                body == null ? "" : body
                        )
                        .replaceAll(
                                "[\\r\\n]+",
                                " "
                        )
                        .trim();

        return clean.length() <= 500
                ? clean
                : clean.substring(0, 500);
    }

    private String maskEmail(
            String email
    ) {
        int at = email.indexOf('@');

        if (at <= 1) {
            return "***"
                    + (
                    at >= 0
                            ? email.substring(at)
                            : ""
            );
        }

        return email.charAt(0)
                + "***"
                + email.substring(at);
    }
}
