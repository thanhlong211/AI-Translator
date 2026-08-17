package com.dangt.aitranslator.backend.config;

import com.dangt.aitranslator.backend.common.ApiError;
import tools.jackson.databind.json.JsonMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

@Component
public class ApiRateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_BUCKETS_BEFORE_CLEANUP = 20_000;
    private static final long CLEANUP_EVERY = 512L;

    private final JsonMapper jsonMapper;
    private final boolean enabled;
    private final Map<String, WindowCounter> counters = new ConcurrentHashMap<>();
    private final AtomicLong requestCounter = new AtomicLong();

    private final Rule authLoginRule;
    private final Rule adminLoginRule;
    private final Rule registerRule;
    private final Rule passwordRule;
    private final Rule socialRule;
    private final Rule aiTranslateRule;
    private final Rule studyRule;
    private final Rule adminApiRule;

    public ApiRateLimitFilter(
            JsonMapper jsonMapper,
            @Value("${app.rate-limit.enabled:false}") boolean enabled,
            @Value("${app.rate-limit.auth-login.requests:30}") int authLoginRequests,
            @Value("${app.rate-limit.auth-login.window-seconds:300}") long authLoginWindowSeconds,
            @Value("${app.rate-limit.admin-login.requests:10}") int adminLoginRequests,
            @Value("${app.rate-limit.admin-login.window-seconds:300}") long adminLoginWindowSeconds,
            @Value("${app.rate-limit.register.requests:10}") int registerRequests,
            @Value("${app.rate-limit.register.window-seconds:3600}") long registerWindowSeconds,
            @Value("${app.rate-limit.password.requests:10}") int passwordRequests,
            @Value("${app.rate-limit.password.window-seconds:900}") long passwordWindowSeconds,
            @Value("${app.rate-limit.social.requests:60}") int socialRequests,
            @Value("${app.rate-limit.social.window-seconds:300}") long socialWindowSeconds,
            @Value("${app.rate-limit.ai.requests:60}") int aiRequests,
            @Value("${app.rate-limit.ai.window-seconds:60}") long aiWindowSeconds,
            @Value("${app.rate-limit.study.requests:30}") int studyRequests,
            @Value("${app.rate-limit.study.window-seconds:60}") long studyWindowSeconds,
            @Value("${app.rate-limit.admin-api.requests:180}") int adminApiRequests,
            @Value("${app.rate-limit.admin-api.window-seconds:60}") long adminApiWindowSeconds
    ) {
        this.jsonMapper = jsonMapper;
        this.enabled = enabled;
        this.authLoginRule = rule("AUTH_LOGIN", authLoginRequests, authLoginWindowSeconds, false);
        this.adminLoginRule = rule("ADMIN_LOGIN", adminLoginRequests, adminLoginWindowSeconds, false);
        this.registerRule = rule("REGISTER", registerRequests, registerWindowSeconds, false);
        this.passwordRule = rule("PASSWORD", passwordRequests, passwordWindowSeconds, false);
        this.socialRule = rule("SOCIAL", socialRequests, socialWindowSeconds, false);
        this.aiTranslateRule = rule("AI_TRANSLATE", aiRequests, aiWindowSeconds, true);
        this.studyRule = rule("STUDY", studyRequests, studyWindowSeconds, true);
        this.adminApiRule = rule("ADMIN_API", adminApiRequests, adminApiWindowSeconds, true);
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        if (!enabled || "OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        Rule rule = classify(request);
        if (rule == null) {
            filterChain.doFilter(request, response);
            return;
        }

        cleanupExpiredCountersOccasionally();

        String clientKey = rule.userScoped()
                ? authenticatedClientKey(request)
                : ipClientKey(request);

        String bucketKey = rule.name() + ':' + clientKey;
        long now = System.currentTimeMillis();
        AtomicReference<Decision> decisionRef = new AtomicReference<>();

        counters.compute(bucketKey, (key, existing) -> {
            WindowCounter current = existing;
            if (current == null || now >= current.resetAtMillis()) {
                current = new WindowCounter(0, now + rule.windowMillis());
            }

            if (current.count() >= rule.requests()) {
                decisionRef.set(new Decision(false, current.resetAtMillis()));
                return current;
            }

            WindowCounter next = new WindowCounter(
                    current.count() + 1,
                    current.resetAtMillis()
            );
            decisionRef.set(new Decision(true, next.resetAtMillis()));
            return next;
        });

        Decision decision = decisionRef.get();
        if (decision != null && !decision.allowed()) {
            long retryAfterSeconds = Math.max(
                    1L,
                    Duration.ofMillis(
                            Math.max(1L, decision.resetAtMillis() - now)
                    ).toSeconds()
            );
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json;charset=UTF-8");
            response.setHeader("Retry-After", Long.toString(retryAfterSeconds));
            jsonMapper.writeValue(
                    response.getOutputStream(),
                    ApiError.of(
                            "RATE_LIMITED",
                            HttpStatus.TOO_MANY_REQUESTS,
                            "Quá nhiều request. Hãy thử lại sau " + retryAfterSeconds + " giây."
                    )
            );
            return;
        }

        filterChain.doFilter(request, response);
    }

    private Rule classify(HttpServletRequest request) {
        if (!"POST".equalsIgnoreCase(request.getMethod())
                && !request.getRequestURI().startsWith("/api/v1/admin/")) {
            return null;
        }

        String path = request.getRequestURI();
        if ("/api/v1/admin/auth/login".equals(path)) {
            return adminLoginRule;
        }
        if ("/api/v1/auth/login".equals(path)
                || "/api/v1/auth/refresh".equals(path)) {
            return authLoginRule;
        }
        if ("/api/v1/auth/register".equals(path)) {
            return registerRule;
        }
        if (path.startsWith("/api/v1/auth/password/")) {
            return passwordRule;
        }

        if (path.startsWith("/api/v1/auth/device-transfer/")) {
            return passwordRule;
        }
        if (path.startsWith("/api/v1/auth/social/")) {
            return socialRule;
        }
        if ("/api/v1/translate".equals(path)
                || "/api/v1/translate/batch".equals(path)) {
            return aiTranslateRule;
        }
        if ("/api/v1/study/analyze".equals(path)) {
            return studyRule;
        }
        if (path.startsWith("/api/v1/admin/")) {
            return adminApiRule;
        }
        return null;
    }

    private String authenticatedClientKey(HttpServletRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null
                && authentication.isAuthenticated()
                && !(authentication instanceof AnonymousAuthenticationToken)) {
            String name = String.valueOf(authentication.getName()).trim();
            if (!name.isBlank()) {
                return "USER:" + name;
            }
        }
        return ipClientKey(request);
    }

    private String ipClientKey(HttpServletRequest request) {
        String remote = String.valueOf(request.getRemoteAddr()).trim();
        return "IP:" + (remote.isBlank() ? "unknown" : remote);
    }

    private void cleanupExpiredCountersOccasionally() {
        long count = requestCounter.incrementAndGet();
        if (counters.size() < MAX_BUCKETS_BEFORE_CLEANUP || count % CLEANUP_EVERY != 0) {
            return;
        }
        long now = System.currentTimeMillis();
        counters.entrySet().removeIf(entry -> now >= entry.getValue().resetAtMillis());
    }

    private static Rule rule(String name, int requests, long windowSeconds, boolean userScoped) {
        return new Rule(
                name,
                Math.max(1, requests),
                Math.max(1L, windowSeconds) * 1000L,
                userScoped
        );
    }

    private record Rule(String name, int requests, long windowMillis, boolean userScoped) {
    }

    private record WindowCounter(int count, long resetAtMillis) {
    }

    private record Decision(boolean allowed, long resetAtMillis) {
    }
}
