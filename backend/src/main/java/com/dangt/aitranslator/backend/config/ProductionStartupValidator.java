package com.dangt.aitranslator.backend.config;

import java.net.URI;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Component
@Profile("prod")
public class ProductionStartupValidator implements ApplicationRunner {

    private static final Set<String> SAFE_ACTUATOR_ENDPOINTS =
            Set.of("health", "info");

    private final Environment environment;

    public ProductionStartupValidator(Environment environment) {
        this.environment = environment;
    }

    @Override
    public void run(ApplicationArguments args) {
        List<String> problems = new ArrayList<>();

        requireNonBlank(
                "spring.datasource.password",
                "DB_PASSWORD is required in production.",
                problems
        );
        requireNonBlank(
                "app.jwt.secret-base64",
                "JWT_SECRET_BASE64 is required in production.",
                problems
        );
        requireNonBlank(
                "spring.datasource.url",
                "DB_URL is required in production.",
                problems
        );

        validateCors(problems);
        validateDocumentation(problems);
        validateActuator(problems);
        validateForwardedHeaders(problems);
        validateErrorExposure(problems);
        validateDatabaseTls(problems);
        validateSocialLogin(problems);
        validatePasswordResetDelivery(problems);

        if (!problems.isEmpty()) {
            throw new IllegalStateException(
                    "Production hardening validation failed:\n - "
                            + String.join("\n - ", problems)
            );
        }
    }

    private void validateCors(List<String> problems) {
        String raw = property("app.cors.allowed-origins");
        List<String> origins = Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .toList();

        if (origins.isEmpty()) {
            problems.add("CORS_ALLOWED_ORIGINS must contain at least one exact production origin.");
            return;
        }

        boolean requireHttps = booleanProperty(
                "app.production.require-https-cors",
                true
        );

        for (String origin : origins) {
            String lower = origin.toLowerCase(Locale.ROOT);
            if ("*".equals(origin) || lower.contains("localhost") || lower.contains("127.0.0.1")) {
                problems.add("Production CORS allowlist must not contain wildcard or localhost origins.");
                break;
            }
            if (requireHttps && !lower.startsWith("https://")) {
                problems.add("Production CORS origins must use HTTPS.");
                break;
            }
        }
    }

    private void validateDocumentation(List<String> problems) {
        if (booleanProperty("springdoc.api-docs.enabled", true)) {
            problems.add("springdoc.api-docs.enabled must be false in production.");
        }
        if (booleanProperty("springdoc.swagger-ui.enabled", true)) {
            problems.add("springdoc.swagger-ui.enabled must be false in production.");
        }
    }

    private void validateActuator(List<String> problems) {
        String raw = property("management.endpoints.web.exposure.include");
        Set<String> exposed = new HashSet<>();
        for (String item : raw.split(",")) {
            String value = item.trim().toLowerCase(Locale.ROOT);
            if (!value.isEmpty()) {
                exposed.add(value);
            }
        }

        if (exposed.isEmpty() || !SAFE_ACTUATOR_ENDPOINTS.containsAll(exposed)) {
            problems.add("Production Actuator exposure may contain only health and optionally info.");
        }
    }

    private void validateForwardedHeaders(List<String> problems) {
        String strategy = property("server.forward-headers-strategy");
        if (!"framework".equalsIgnoreCase(strategy)) {
            problems.add("server.forward-headers-strategy must be framework in production.");
        }
    }

    private void validateErrorExposure(List<String> problems) {
        if (!"never".equalsIgnoreCase(property("server.error.include-message"))) {
            problems.add("server.error.include-message must be never in production.");
        }
        if (!"never".equalsIgnoreCase(property("server.error.include-stacktrace"))) {
            problems.add("server.error.include-stacktrace must be never in production.");
        }
    }

    private void validateDatabaseTls(List<String> problems) {
        if (!booleanProperty("app.production.require-db-tls", true)) {
            return;
        }

        String url = property("spring.datasource.url").toLowerCase(Locale.ROOT);
        if (url.contains("usessl=false")
                || url.contains("sslmode=disabled")
                || url.contains("allowpublickeyretrieval=true")) {
            problems.add(
                    "Production DB_URL must not disable TLS or enable allowPublicKeyRetrieval."
            );
        }
    }

    private void validateSocialLogin(List<String> problems) {
        String googleId = property("app.auth.social.google.client-id");
        String googleSecret = property("app.auth.social.google.client-secret");
        String facebookId = property("app.auth.social.facebook.client-id");
        String facebookSecret = property("app.auth.social.facebook.client-secret");

        validateProviderPair(
                "Google",
                googleId,
                googleSecret,
                "GOOGLE_OAUTH_CLIENT_ID",
                "GOOGLE_OAUTH_CLIENT_SECRET",
                problems
        );
        validateProviderPair(
                "Facebook",
                facebookId,
                facebookSecret,
                "FACEBOOK_APP_ID",
                "FACEBOOK_APP_SECRET",
                problems
        );

        boolean anyProviderConfigured =
                (!googleId.isBlank() && !googleSecret.isBlank())
                        || (!facebookId.isBlank() && !facebookSecret.isBlank());

        if (!anyProviderConfigured) {
            return;
        }

        String publicBaseUrl = property("app.auth.social.public-base-url");
        try {
            URI uri = URI.create(publicBaseUrl);
            String host = String.valueOf(uri.getHost()).toLowerCase(Locale.ROOT);
            boolean localHost = host.equals("localhost")
                    || host.equals("127.0.0.1")
                    || host.equals("::1");
            if (!"https".equalsIgnoreCase(uri.getScheme())
                    || host.isBlank()
                    || "null".equals(host)
                    || localHost
                    || uri.getUserInfo() != null) {
                throw new IllegalArgumentException("unsafe social callback origin");
            }
        } catch (Exception ex) {
            problems.add(
                    "SOCIAL_AUTH_PUBLIC_BASE_URL must be the public HTTPS backend origin when Social Login is configured."
            );
        }
    }

    private void validateProviderPair(
            String provider,
            String clientId,
            String clientSecret,
            String clientIdEnv,
            String clientSecretEnv,
            List<String> problems
    ) {
        if (clientId.isBlank() == clientSecret.isBlank()) {
            return;
        }
        problems.add(
                provider + " Social Login is only partially configured; set both "
                        + clientIdEnv + " and " + clientSecretEnv + "."
        );
    }

    private void validatePasswordResetDelivery(List<String> problems) {
        String mode = property("app.password-reset.delivery").toUpperCase(Locale.ROOT);

        requireNonBlank(
                "app.password-reset.mail-from",
                "PASSWORD_RESET_MAIL_FROM is required in production.",
                problems
        );

        if ("RESEND".equals(mode)) {
            requireNonBlank(
                    "app.password-reset.resend-api-key",
                    "RESEND_API_KEY is required when PASSWORD_RESET_DELIVERY=RESEND.",
                    problems
            );

            String apiUrl = property("app.password-reset.resend-api-url");
            try {
                URI uri = URI.create(apiUrl);
                String host = String.valueOf(uri.getHost()).toLowerCase(Locale.ROOT);
                if (!"https".equalsIgnoreCase(uri.getScheme())
                        || host.isBlank()
                        || "null".equals(host)
                        || host.equals("localhost")
                        || host.equals("127.0.0.1")
                        || host.equals("::1")
                        || uri.getUserInfo() != null) {
                    throw new IllegalArgumentException("unsafe resend API URL");
                }
            } catch (Exception ex) {
                problems.add("RESEND_API_URL must be a public HTTPS URL.");
            }
        } else if ("SMTP".equals(mode)) {
            requireNonBlank(
                    "spring.mail.host",
                    "MAIL_HOST is required for password reset delivery in production.",
                    problems
            );

            boolean smtpAuth = booleanProperty(
                    "spring.mail.properties.mail.smtp.auth",
                    true
            );
            if (smtpAuth) {
                requireNonBlank(
                        "spring.mail.username",
                        "MAIL_USERNAME is required when SMTP authentication is enabled.",
                        problems
                );
                requireNonBlank(
                        "spring.mail.password",
                        "MAIL_PASSWORD is required when SMTP authentication is enabled.",
                        problems
                );
            }

            boolean startTls = booleanProperty(
                    "spring.mail.properties.mail.smtp.starttls.enable",
                    false
            );
            boolean ssl = booleanProperty(
                    "spring.mail.properties.mail.smtp.ssl.enable",
                    false
            );
            if (!startTls && !ssl) {
                problems.add("Production SMTP must enable STARTTLS or SSL.");
            }
        } else {
            problems.add(
                    "PASSWORD_RESET_DELIVERY must be RESEND or SMTP in production."
            );
        }

        String resetUrl = property("app.password-reset.reset-url-base").toLowerCase(Locale.ROOT);
        if (!resetUrl.isBlank() && !resetUrl.startsWith("https://")) {
            problems.add("PASSWORD_RESET_URL_BASE must use HTTPS when configured in production.");
        }
    }

    private void requireNonBlank(
            String propertyName,
            String message,
            List<String> problems
    ) {
        if (property(propertyName).isBlank()) {
            problems.add(message);
        }
    }

    private boolean booleanProperty(String name, boolean fallback) {
        Boolean value = environment.getProperty(name, Boolean.class);
        return value == null ? fallback : value;
    }

    private String property(String name) {
        return String.valueOf(environment.getProperty(name, "")).trim();
    }
}
