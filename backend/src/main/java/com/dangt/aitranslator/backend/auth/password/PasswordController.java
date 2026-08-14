package com.dangt.aitranslator.backend.auth.password;

import com.dangt.aitranslator.backend.auth.CurrentUserService;
import com.dangt.aitranslator.backend.user.UserAccount;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth/password")
public class PasswordController {

    private final PasswordService passwordService;
    private final CurrentUserService currentUserService;

    public PasswordController(
            PasswordService passwordService,
            CurrentUserService currentUserService
    ) {
        this.passwordService = passwordService;
        this.currentUserService = currentUserService;
    }

    @PostMapping("/forgot")
    public ForgotPasswordResponse forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request,
            HttpServletRequest httpRequest
    ) {
        return passwordService.requestReset(
                request.email(),
                clientIp(httpRequest)
        );
    }

    @PostMapping("/reset")
    public PasswordActionResponse resetPassword(
            @Valid @RequestBody ResetPasswordRequest request
    ) {
        return passwordService.resetPassword(request);
    }

    @PostMapping("/change")
    public PasswordActionResponse changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount user = currentUserService.requireActiveUser(jwt);
        return passwordService.changePassword(user, request);
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            String first = forwarded.split(",", 2)[0].trim();
            if (!first.isBlank()) {
                return first;
            }
        }
        return request.getRemoteAddr();
    }
}
