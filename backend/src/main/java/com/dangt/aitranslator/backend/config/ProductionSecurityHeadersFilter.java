package com.dangt.aitranslator.backend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Profile;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Profile("prod")
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class ProductionSecurityHeadersFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "DENY");
        response.setHeader("Referrer-Policy", "no-referrer");
        response.setHeader(
                "Permissions-Policy",
                "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
        );
        String contentSecurityPolicy =
                isSocialAuthCallback(request)
                        ? "default-src 'none'; "
                        + "style-src 'unsafe-inline'; "
                        + "script-src 'unsafe-inline'; "
                        + "frame-ancestors 'none'; "
                        + "base-uri 'none'; "
                        + "form-action 'none'"
                        : "default-src 'none'; "
                        + "frame-ancestors 'none'; "
                        + "base-uri 'none'; "
                        + "form-action 'none'";

        response.setHeader(
                "Content-Security-Policy",
                contentSecurityPolicy
        );

        if (request.getRequestURI().startsWith("/api/")) {
            response.setHeader(
                    "Cache-Control",
                    "no-store, no-cache, max-age=0, must-revalidate"
            );
            response.setHeader("Pragma", "no-cache");
        }

        if (request.isSecure()) {
            response.setHeader(
                    "Strict-Transport-Security",
                    "max-age=31536000; includeSubDomains"
            );
        }

        filterChain.doFilter(request, response);
    }

    private static boolean isSocialAuthCallback(HttpServletRequest request) {
        String uri = request.getRequestURI();

        return "/api/v1/auth/social/google/callback".equals(uri)
                || "/api/v1/auth/social/facebook/callback".equals(uri);
    }
}
