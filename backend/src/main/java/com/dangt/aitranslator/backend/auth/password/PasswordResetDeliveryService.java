package com.dangt.aitranslator.backend.auth.password;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;

@Service
public class PasswordResetDeliveryService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetDeliveryService.class);
    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final String deliveryMode;
    private final String mailFrom;
    private final String resetUrlBase;
    private final String resendApiUrl;
    private final String resendApiKey;
    private final int ttlMinutes;

    public PasswordResetDeliveryService(
            ObjectProvider<JavaMailSender> mailSenderProvider,
            @Value("${app.password-reset.delivery:LOG}") String deliveryMode,
            @Value("${app.password-reset.mail-from:no-reply@localhost}") String mailFrom,
            @Value("${app.password-reset.reset-url-base:ai-translator://reset-password}") String resetUrlBase,
            @Value("${app.password-reset.resend-api-url:https://api.resend.com/emails}") String resendApiUrl,
            @Value("${app.password-reset.resend-api-key:}") String resendApiKey,
            @Value("${app.password-reset.ttl-minutes:30}") int ttlMinutes
    ) {
        this.mailSenderProvider = mailSenderProvider;
        this.deliveryMode = String.valueOf(deliveryMode).trim().toUpperCase(Locale.ROOT);
        this.mailFrom = String.valueOf(mailFrom).trim();
        this.resetUrlBase = String.valueOf(resetUrlBase).trim();
        this.resendApiUrl = String.valueOf(resendApiUrl).trim();
        this.resendApiKey = String.valueOf(resendApiKey).trim();
        this.ttlMinutes = Math.max(5, Math.min(ttlMinutes, 120));
    }

    public void deliver(String email, String resetToken) {
        String resetUrl = buildResetUrl(resetToken);

        if ("LOG".equals(deliveryMode)) {
            log.warn(
                "DEV PASSWORD RESET requested for {} expires in {} minutes; raw reset token is not logged.",
                maskEmail(email),
                ttlMinutes
            );
            return;
        }

        if ("RESEND".equals(deliveryMode)) {
            deliverWithResend(email, resetToken, resetUrl);
            return;
        }

        if (!"SMTP".equals(deliveryMode)) {
            throw new IllegalStateException("Unsupported password reset delivery mode: " + deliveryMode);
        }

        deliverWithSmtp(email, resetToken, resetUrl);
    }

    private void deliverWithSmtp(String email, String resetToken, String resetUrl) {
        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            throw new IllegalStateException("SMTP password reset delivery is not available.");
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(mailFrom);
        message.setTo(email);
        message.setSubject("AitraNova - Reset your password");
        message.setText(buildMessageText(resetToken, resetUrl));
        mailSender.send(message);
    }

    private void deliverWithResend(String email, String resetToken, String resetUrl) {
        if (resendApiKey.isBlank()) {
            throw new IllegalStateException("RESEND_API_KEY is required for Resend delivery.");
        }
        if (resendApiUrl.isBlank()) {
            throw new IllegalStateException("RESEND_API_URL is required for Resend delivery.");
        }

        String payload = "{"
                + "\"from\":" + jsonString(mailFrom) + ","
                + "\"to\":[" + jsonString(email) + "],"
                + "\"subject\":" + jsonString("AitraNova - Reset your password") + ","
                + "\"text\":" + jsonString(buildMessageText(resetToken, resetUrl))
                + "}";

        HttpRequest request = HttpRequest.newBuilder(URI.create(resendApiUrl))
                .timeout(Duration.ofSeconds(12))
                .header("Authorization", "Bearer " + resendApiKey)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8))
                .build();

        try {
            HttpResponse<String> response = HTTP_CLIENT.send(
                    request,
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)
            );

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException(
                    "Resend API returned HTTP "
                        + response.statusCode()
                        + "."
                );
            }
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Resend API request was interrupted.", ex);
        } catch (Exception ex) {
            if (ex instanceof IllegalStateException illegalStateException) {
                throw illegalStateException;
            }
            throw new IllegalStateException("Resend API request failed.", ex);
        }
    }

    private String buildMessageText(String resetToken, String resetUrl) {
        String linkPart = resetUrl.isBlank()
                ? ""
                : "\n\nReset link:\n" + resetUrl;

        return "A password reset was requested for your AitraNova account.\n\n"
                + "Reset code:\n" + resetToken
                + linkPart
                + "\n\nThis code expires in " + ttlMinutes + " minutes.\n"
                + "If you did not request this, you can ignore this message.";
    }

    private String buildResetUrl(String token) {
        if (resetUrlBase.isBlank()) {
            return "";
        }
        String separator = resetUrlBase.contains("?") ? "&" : "?";
        return resetUrlBase
                + separator
                + "token="
                + URLEncoder.encode(token, StandardCharsets.UTF_8);
    }

    private String jsonString(String value) {
        StringBuilder out = new StringBuilder(value.length() + 16);
        out.append('"');
        for (int i = 0; i < value.length(); i++) {
            char ch = value.charAt(i);
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
                        out.append(String.format("\\u%04x", (int) ch));
                    } else {
                        out.append(ch);
                    }
                }
            }
        }
        out.append('"');
        return out.toString();
    }


    private String maskEmail(String email) {
        int at = email.indexOf('@');
        if (at <= 1) {
            return "***" + (at >= 0 ? email.substring(at) : "");
        }
        return email.charAt(0) + "***" + email.substring(at);
    }
}
