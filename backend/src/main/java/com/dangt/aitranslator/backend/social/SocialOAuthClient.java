package com.dangt.aitranslator.backend.social;

import com.dangt.aitranslator.backend.common.ForbiddenException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Service
public class SocialOAuthClient {

    /**
     * Mapper cục bộ chỉ dùng để parse JSON từ OAuth provider.
     * Không inject qua Spring vì backend hiện tại không đảm bảo có
     * com.fasterxml.jackson.databind.ObjectMapper bean trong context.
     */
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private final HttpClient httpClient;
    private final String publicBaseUrl;
    private final String googleClientId;
    private final String googleClientSecret;
    private final String facebookClientId;
    private final String facebookClientSecret;

    public SocialOAuthClient(
            @Value("${app.auth.social.public-base-url:http://localhost:8080}") String publicBaseUrl,
            @Value("${app.auth.social.google.client-id:}") String googleClientId,
            @Value("${app.auth.social.google.client-secret:}") String googleClientSecret,
            @Value("${app.auth.social.facebook.client-id:}") String facebookClientId,
            @Value("${app.auth.social.facebook.client-secret:}") String facebookClientSecret
    ) {
        this.publicBaseUrl = trimTrailingSlash(publicBaseUrl);
        this.googleClientId = clean(googleClientId);
        this.googleClientSecret = clean(googleClientSecret);
        this.facebookClientId = clean(facebookClientId);
        this.facebookClientSecret = clean(facebookClientSecret);
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    public List<SocialProviderStatus> providerStatuses() {
        List<SocialProviderStatus> result = new ArrayList<>();
        result.add(status(SocialAuthProvider.GOOGLE));
        result.add(status(SocialAuthProvider.FACEBOOK));
        return result;
    }

    public SocialProviderStatus status(SocialAuthProvider provider) {
        boolean credentialsReady = switch (provider) {
            case GOOGLE -> !googleClientId.isBlank() && !googleClientSecret.isBlank();
            case FACEBOOK -> !facebookClientId.isBlank() && !facebookClientSecret.isBlank();
        };
        boolean callbackReady = isValidPublicBaseUrl();
        boolean available = credentialsReady && callbackReady;

        String reason;
        if (!credentialsReady) {
            reason = "Chưa cấu hình OAuth client trên backend.";
        } else if (!callbackReady) {
            reason = "SOCIAL_AUTH_PUBLIC_BASE_URL phải là HTTPS (trừ localhost khi dev).";
        } else {
            reason = null;
        }

        return new SocialProviderStatus(
                provider.name(),
                provider.displayName(),
                available,
                reason
        );
    }

    public String callbackUrl(SocialAuthProvider provider) {
        return publicBaseUrl + "/api/v1/auth/social/" + provider.pathCode() + "/callback";
    }

    public String authorizationUrl(
            SocialAuthProvider provider,
            String state
    ) {
        requireAvailable(provider);

        return switch (provider) {
            case GOOGLE -> "https://accounts.google.com/o/oauth2/v2/auth?" + query(
                    "client_id", googleClientId,
                    "redirect_uri", callbackUrl(provider),
                    "response_type", "code",
                    "scope", "openid email profile",
                    "state", state,
                    "prompt", "select_account"
            );
            case FACEBOOK -> "https://www.facebook.com/dialog/oauth?" + query(
                    "client_id", facebookClientId,
                    "redirect_uri", callbackUrl(provider),
                    "response_type", "code",
                    "scope", "email",
                    "state", state
            );
        };
    }

    public SocialProviderProfile exchangeCode(
            SocialAuthProvider provider,
            String code
    ) {
        requireAvailable(provider);

        try {
            return switch (provider) {
                case GOOGLE -> exchangeGoogle(code);
                case FACEBOOK -> exchangeFacebook(code);
            };
        } catch (ForbiddenException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ForbiddenException(
                    "Không xác minh được tài khoản " + provider.displayName() + "."
            );
        }
    }

    private SocialProviderProfile exchangeGoogle(
            String code
    ) throws Exception {
        String body = form(
                "client_id", googleClientId,
                "client_secret", googleClientSecret,
                "code", clean(code),
                "grant_type", "authorization_code",
                "redirect_uri", callbackUrl(SocialAuthProvider.GOOGLE)
        );

        JsonNode token = postFormJson(
                "https://oauth2.googleapis.com/token",
                body
        );

        String accessToken = text(token, "access_token");
        if (accessToken.isBlank()) {
            throw new ForbiddenException("Google không trả về access token hợp lệ.");
        }

        JsonNode userInfo = getBearerJson(
                "https://openidconnect.googleapis.com/v1/userinfo",
                accessToken
        );

        String subject = text(userInfo, "sub");
        String email = text(userInfo, "email");
        boolean emailVerified = userInfo.path("email_verified").asBoolean(false);

        if (subject.isBlank()) {
            throw new ForbiddenException("Google identity không hợp lệ.");
        }

        return new SocialProviderProfile(
                subject,
                email,
                emailVerified,
                text(userInfo, "name"),
                text(userInfo, "picture")
        );
    }

    private SocialProviderProfile exchangeFacebook(
            String code
    ) throws Exception {
        String body = form(
                "client_id", facebookClientId,
                "client_secret", facebookClientSecret,
                "redirect_uri", callbackUrl(SocialAuthProvider.FACEBOOK),
                "code", clean(code)
        );

        JsonNode token = postFormJson(
                "https://graph.facebook.com/oauth/access_token",
                body
        );

        String accessToken = text(token, "access_token");
        if (accessToken.isBlank()) {
            throw new ForbiddenException("Facebook không trả về access token hợp lệ.");
        }

        String userInfoUrl = "https://graph.facebook.com/me?" + query(
                "fields", "id,name,email,picture.type(large)"
        );

        JsonNode userInfo = getBearerJson(userInfoUrl, accessToken);
        String subject = text(userInfo, "id");

        if (subject.isBlank()) {
            throw new ForbiddenException("Facebook identity không hợp lệ.");
        }

        String picture = userInfo.path("picture")
                .path("data")
                .path("url")
                .asText("");

        /*
         * Facebook /me không cung cấp một cờ email_verified tương đương
         * trong flow tối thiểu này. Vì vậy email Facebook KHÔNG được dùng
         * để tự động link vào account cũ. Link account cũ phải được người
         * dùng thực hiện sau khi đã đăng nhập AI Translator.
         */
        return new SocialProviderProfile(
                subject,
                text(userInfo, "email"),
                false,
                text(userInfo, "name"),
                picture
        );
    }

    private JsonNode postFormJson(String url, String formBody) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(20))
                .header("Accept", "application/json")
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(formBody))
                .build();

        HttpResponse<String> response = httpClient.send(
                request,
                HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)
        );

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new ForbiddenException("OAuth token exchange bị từ chối.");
        }

        return OBJECT_MAPPER.readTree(response.body());
    }

    private JsonNode getBearerJson(String url, String accessToken) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(20))
                .header("Accept", "application/json")
                .header("Authorization", "Bearer " + accessToken)
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(
                request,
                HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)
        );

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new ForbiddenException("Không đọc được hồ sơ OAuth.");
        }

        return OBJECT_MAPPER.readTree(response.body());
    }

    private void requireAvailable(SocialAuthProvider provider) {
        if (!status(provider).available()) {
            throw new ForbiddenException(
                    provider.displayName() + " Login chưa được cấu hình trên backend."
            );
        }
    }

    private boolean isValidPublicBaseUrl() {
        try {
            URI uri = URI.create(publicBaseUrl);
            String host = clean(uri.getHost()).toLowerCase();
            boolean local = host.equals("localhost") ||
                    host.equals("127.0.0.1") ||
                    host.equals("::1");
            return "https".equalsIgnoreCase(uri.getScheme()) ||
                    (local && "http".equalsIgnoreCase(uri.getScheme()));
        } catch (Exception ex) {
            return false;
        }
    }

    private static String text(JsonNode node, String field) {
        return node == null ? "" : clean(node.path(field).asText(""));
    }

    private static String query(String... pairs) {
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i + 1 < pairs.length; i += 2) {
            if (builder.length() > 0) {
                builder.append('&');
            }
            builder.append(encode(pairs[i]))
                    .append('=')
                    .append(encode(pairs[i + 1]));
        }
        return builder.toString();
    }

    private static String form(String... pairs) {
        return query(pairs);
    }

    private static String encode(String value) {
        return URLEncoder.encode(
                String.valueOf(value),
                StandardCharsets.UTF_8
        );
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private static String trimTrailingSlash(String value) {
        String cleaned = clean(value);
        while (cleaned.endsWith("/")) {
            cleaned = cleaned.substring(0, cleaned.length() - 1);
        }
        return cleaned.isBlank() ? "http://localhost:8080" : cleaned;
    }
}
