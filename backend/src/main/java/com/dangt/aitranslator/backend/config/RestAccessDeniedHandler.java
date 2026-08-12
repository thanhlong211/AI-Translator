package com.dangt.aitranslator.backend.config;

import com.dangt.aitranslator.backend.common.RequestCorrelation;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
public class RestAccessDeniedHandler
        implements AccessDeniedHandler {

    @Override
    public void handle(
            HttpServletRequest request,
            HttpServletResponse response,
            AccessDeniedException accessDeniedException
    ) throws java.io.IOException {
        String requestId =
                RequestCorrelation
                        .currentId();

        response.setStatus(
                HttpServletResponse.SC_FORBIDDEN
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
                {"success":false,"code":"FORBIDDEN","status":403,"error":"Bạn không có quyền thực hiện thao tác này.","requestId":"%s","timestamp":"%s"}
                """
                        .formatted(
                                requestId,
                                Instant.now()
                        )
                        .trim()
        );
    }
}
