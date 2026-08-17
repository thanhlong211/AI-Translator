package com.dangt.aitranslator.backend.auth.email;

import com.dangt.aitranslator.backend.auth.AuthResponse;
import com.dangt.aitranslator.backend.auth.AuthService;
import com.dangt.aitranslator.backend.common.ApiError;
import com.dangt.aitranslator.backend.user.UserAccount;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth/email-verification")
public class EmailVerificationController {

    private final EmailVerificationService
            emailVerificationService;

    private final AuthService authService;

    public EmailVerificationController(
            EmailVerificationService emailVerificationService,
            AuthService authService
    ) {
        this.emailVerificationService =
                emailVerificationService;

        this.authService =
                authService;
    }

    @PostMapping("/request")
    public EmailVerificationRequestResponse
    requestVerification(
            @Valid
            @RequestBody
            EmailVerificationRequest request,

            HttpServletRequest httpRequest
    ) {
        return emailVerificationService
                .requestVerification(
                        request,
                        clientIp(
                                httpRequest
                        )
                );
    }

    @PostMapping("/confirm")
    public AuthResponse confirmVerification(
            @Valid
            @RequestBody
            EmailVerificationConfirmRequest request
    ) {
        UserAccount user =
                emailVerificationService
                        .confirm(
                                request
                        );

        return authService
                .createSessionForUser(
                        user,
                        request.deviceId(),
                        request.deviceName()
                );
    }

    @ExceptionHandler(
            EmailVerificationException.class
    )
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiError handleVerification(
            EmailVerificationException ex
    ) {
        return ApiError.of(
                ex.getCode(),
                HttpStatus.BAD_REQUEST,
                ex.getMessage()
        );
    }

    private String clientIp(
            HttpServletRequest request
    ) {
        String forwarded =
                request.getHeader(
                        "X-Forwarded-For"
                );

        if (
                forwarded != null
                && !forwarded.isBlank()
        ) {
            String first =
                    forwarded
                            .split(
                                    ",",
                                    2
                            )[0]
                            .trim();

            if (!first.isBlank()) {
                return first;
            }
        }

        return request
                .getRemoteAddr();
    }
}
