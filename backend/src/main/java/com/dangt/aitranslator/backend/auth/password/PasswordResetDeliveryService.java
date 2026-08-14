package com.dangt.aitranslator.backend.auth.password;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

@Service
public class PasswordResetDeliveryService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetDeliveryService.class);

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final String deliveryMode;
    private final String mailFrom;
    private final String resetUrlBase;
    private final int ttlMinutes;

    public PasswordResetDeliveryService(
            ObjectProvider<JavaMailSender> mailSenderProvider,
            @Value("${app.password-reset.delivery:LOG}") String deliveryMode,
            @Value("${app.password-reset.mail-from:no-reply@localhost}") String mailFrom,
            @Value("${app.password-reset.reset-url-base:ai-translator://reset-password}") String resetUrlBase,
            @Value("${app.password-reset.ttl-minutes:30}") int ttlMinutes
    ) {
        this.mailSenderProvider = mailSenderProvider;
        this.deliveryMode = String.valueOf(deliveryMode).trim().toUpperCase(Locale.ROOT);
        this.mailFrom = String.valueOf(mailFrom).trim();
        this.resetUrlBase = String.valueOf(resetUrlBase).trim();
        this.ttlMinutes = Math.max(5, Math.min(ttlMinutes, 120));
    }

    public void deliver(String email, String resetToken) {
        String resetUrl = buildResetUrl(resetToken);

        if ("LOG".equals(deliveryMode)) {
            log.warn(
                    "DEV PASSWORD RESET for {} expires in {} minutes: {}",
                    maskEmail(email),
                    ttlMinutes,
                    resetUrl.isBlank() ? resetToken : resetUrl
            );
            return;
        }

        if (!"SMTP".equals(deliveryMode)) {
            throw new IllegalStateException("Unsupported password reset delivery mode: " + deliveryMode);
        }

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            throw new IllegalStateException("SMTP password reset delivery is not available.");
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(mailFrom);
        message.setTo(email);
        message.setSubject("AI Translator - Reset your password");
        String linkPart = resetUrl.isBlank()
                ? ""
                : "\n\nReset link:\n" + resetUrl;

        message.setText(
                "A password reset was requested for your AI Translator account.\n\n"
                        + "Reset code:\n" + resetToken
                        + linkPart
                        + "\n\nThis code expires in " + ttlMinutes + " minutes.\n"
                        + "If you did not request this, you can ignore this message."
        );
        mailSender.send(message);
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

    private String maskEmail(String email) {
        int at = email.indexOf('@');
        if (at <= 1) {
            return "***" + (at >= 0 ? email.substring(at) : "");
        }
        return email.charAt(0) + "***" + email.substring(at);
    }
}
