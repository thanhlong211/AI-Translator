package com.dangt.aitranslator.backend.admin;

import com.dangt.aitranslator.backend.common.ConflictException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Set;

@Component
public class AdminSafetyInterceptor implements HandlerInterceptor {

    private static final Set<String> READ_METHODS = Set.of("GET", "HEAD", "OPTIONS");

    private final AdminSafetyService safetyService;
    private final AdminSecurityEventService securityEventService;

    public AdminSafetyInterceptor(
            AdminSafetyService safetyService,
            AdminSecurityEventService securityEventService
    ) {
        this.safetyService = safetyService;
        this.securityEventService = securityEventService;
    }

    @Override
    public boolean preHandle(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler
    ) {
        if (request == null || READ_METHODS.contains(String.valueOf(request.getMethod()).toUpperCase())) {
            return true;
        }

        String path = String.valueOf(request.getRequestURI());
        if (!path.startsWith("/api/v1/admin/")) {
            return true;
        }
        if (isBypassPath(path)) {
            return true;
        }

        if (safetyService.isReadOnly()) {
            securityEventService.recordAdminAccessDenied(
                    request,
                    "ADMIN_WRITE_BLOCKED_READ_ONLY",
                    "SAFETY_READ_ONLY"
            );
            throw new ConflictException(
                    "Admin Console đang ở READ_ONLY. Chỉ xem dữ liệu; write operation này đã bị chặn."
            );
        }
        return true;
    }

    private boolean isBypassPath(String path) {
        if (path.startsWith("/api/v1/admin/auth/")) {
            return true;
        }
        if ("/api/v1/admin/safety/mode".equals(path)) {
            return true;
        }
        return path.matches("^/api/v1/admin/error-events/\\d+/(acknowledge|resolve)$");
    }
}
