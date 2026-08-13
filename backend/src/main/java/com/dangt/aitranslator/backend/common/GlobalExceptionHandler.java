package com.dangt.aitranslator.backend.common;

import com.dangt.aitranslator.backend.admin.AdminSecurityEventService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log =
            LoggerFactory.getLogger(
                    GlobalExceptionHandler.class
            );

    private final AdminSecurityEventService securityEventService;

    public GlobalExceptionHandler(
            AdminSecurityEventService securityEventService
    ) {
        this.securityEventService = securityEventService;
    }

    @ExceptionHandler(
            HttpMessageNotReadableException.class
    )
    ResponseEntity<ApiError> malformedJson(
            HttpMessageNotReadableException ex
    ) {
        return error(
                HttpStatus.BAD_REQUEST,
                "MALFORMED_JSON",
                "JSON request không hợp lệ hoặc bị thiếu dữ liệu."
        );
    }

    @ExceptionHandler(
            MethodArgumentNotValidException.class
    )
    ResponseEntity<ApiError> validationError(
            MethodArgumentNotValidException ex
    ) {
        String message =
                ex.getBindingResult()
                        .getFieldErrors()
                        .stream()
                        .findFirst()
                        .map(
                                error ->
                                        error
                                                .getDefaultMessage()
                        )
                        .orElse(
                                "Dữ liệu không hợp lệ."
                        );

        return error(
                HttpStatus.BAD_REQUEST,
                "VALIDATION_ERROR",
                message
        );
    }

    @ExceptionHandler(
            ConflictException.class
    )
    ResponseEntity<ApiError> conflict(
            ConflictException ex
    ) {
        return error(
                HttpStatus.CONFLICT,
                "CONFLICT",
                ex.getMessage()
        );
    }

    @ExceptionHandler(
            UnauthorizedException.class
    )
    ResponseEntity<ApiError> unauthorized(
            UnauthorizedException ex,
            HttpServletRequest request
    ) {
        recordAdminGuardDenial(
                request,
                "ADMIN_ACCESS_UNAUTHENTICATED",
                "APPLICATION_GUARD"
        );
        return error(
                HttpStatus.UNAUTHORIZED,
                "UNAUTHORIZED",
                ex.getMessage()
        );
    }

    @ExceptionHandler(
            ForbiddenException.class
    )
    ResponseEntity<ApiError> forbidden(
            ForbiddenException ex,
            HttpServletRequest request
    ) {
        recordAdminGuardDenial(
                request,
                "ADMIN_ACCESS_FORBIDDEN",
                "APPLICATION_GUARD"
        );
        return error(
                HttpStatus.FORBIDDEN,
                "FORBIDDEN",
                ex.getMessage()
        );
    }

    @ExceptionHandler(
            AiResponseFormatException.class
    )
    ResponseEntity<ApiError> aiResponseFormat(
            AiResponseFormatException ex
    ) {
        log.warn(
                "AI response format error requestId={} message={}",
                RequestCorrelation.currentId(),
                ex.getMessage()
        );

        return error(
                HttpStatus.BAD_GATEWAY,
                "AI_RESPONSE_FORMAT",
                ex.getMessage()
        );
    }

    @ExceptionHandler(
            IllegalArgumentException.class
    )
    ResponseEntity<ApiError> badRequest(
            IllegalArgumentException ex
    ) {
        return error(
                HttpStatus.BAD_REQUEST,
                "BAD_REQUEST",
                ex.getMessage()
        );
    }

    @ExceptionHandler(
            Exception.class
    )
    ResponseEntity<ApiError> unexpected(
            Exception ex
    ) {
        log.error(
                "Backend error requestId={}",
                RequestCorrelation.currentId(),
                ex
        );

        return error(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Backend xử lý thất bại."
        );
    }

    private void recordAdminGuardDenial(
            HttpServletRequest request,
            String eventType,
            String reasonCode
    ) {
        if (request == null) {
            return;
        }
        String path = String.valueOf(request.getRequestURI());
        if (!path.startsWith("/api/v1/admin/")
                || "/api/v1/admin/auth/login".equals(path)) {
            return;
        }
        securityEventService.recordAdminAccessDenied(
                request,
                eventType,
                reasonCode
        );
    }

    private ResponseEntity<ApiError> error(
            HttpStatus status,
            String code,
            String message
    ) {
        return ResponseEntity
                .status(status)
                .body(
                        ApiError.of(
                                code,
                                status,
                                message
                        )
                );
    }
}
