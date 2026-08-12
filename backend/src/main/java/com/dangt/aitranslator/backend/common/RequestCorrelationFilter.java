package com.dangt.aitranslator.backend.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestCorrelationFilter
        extends OncePerRequestFilter {

    private static final Pattern SAFE_REQUEST_ID =
            Pattern.compile(
                    "^[A-Za-z0-9._:-]{8,100}$"
            );

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String incoming =
                request.getHeader(
                        RequestCorrelation.HEADER_NAME
                );

        String requestId =
                normalize(
                        incoming
                );

        MDC.put(
                RequestCorrelation.MDC_KEY,
                requestId
        );

        response.setHeader(
                RequestCorrelation.HEADER_NAME,
                requestId
        );

        try {
            filterChain.doFilter(
                    request,
                    response
            );
        } finally {
            MDC.remove(
                    RequestCorrelation.MDC_KEY
            );
        }
    }

    private String normalize(
            String incoming
    ) {
        String value =
                incoming == null
                        ? ""
                        : incoming.trim();

        if (
                SAFE_REQUEST_ID
                        .matcher(value)
                        .matches()
        ) {
            return value;
        }

        return UUID
                .randomUUID()
                .toString();
    }
}
