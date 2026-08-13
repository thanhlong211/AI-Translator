package com.dangt.aitranslator.backend.config;

import com.dangt.aitranslator.backend.admin.AdminSecurityEventService;
import com.dangt.aitranslator.backend.common.RequestCorrelation;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
public class RestAuthenticationEntryPoint
        implements AuthenticationEntryPoint {

    private final AdminSecurityEventService securityEventService;

    public RestAuthenticationEntryPoint(
            AdminSecurityEventService securityEventService
    ) {
        this.securityEventService = securityEventService;
    }

    @Override
    public void commence(
            HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException authException
    ) throws java.io.IOException {
        securityEventService.recordAdminAccessDenied(
                request,
                "ADMIN_ACCESS_UNAUTHENTICATED",
                "MISSING_OR_INVALID_TOKEN"
        );

        String requestId =
                RequestCorrelation
                        .currentId();

        response.setStatus(
                HttpServletResponse.SC_UNAUTHORIZED
        );

        response.setContentType(
                MediaType.APPLICATION_JSON_VALUE
        );

        response.setCharacterEncoding(
                "UTF-8"
        );

        response.setHeader(
                RequestCorrelation.HEADER_NAME,
                requestId
        );

        response.getWriter().write(
                """
                {"success":false,"code":"UNAUTHORIZED","status":401,"error":"Bạn chưa đăng nhập hoặc token không hợp lệ.","requestId":"%s","timestamp":"%s"}
                """
                        .formatted(
                                requestId,
                                Instant.now()
                        )
                        .trim()
        );
    }
}
