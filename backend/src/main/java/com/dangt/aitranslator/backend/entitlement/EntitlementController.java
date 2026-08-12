package com.dangt.aitranslator.backend.entitlement;

import com.dangt.aitranslator.backend.auth.CurrentUserService;
import com.dangt.aitranslator.backend.user.UserAccount;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/account")
@Tag(name = "Entitlements", description = "Plan, feature entitlement, limit và license của tài khoản.")
public class EntitlementController {

    private final CurrentUserService currentUserService;
    private final EntitlementService entitlementService;
    private final LicenseService licenseService;

    public EntitlementController(
            CurrentUserService currentUserService,
            EntitlementService entitlementService,
            LicenseService licenseService
    ) {
        this.currentUserService = currentUserService;
        this.entitlementService = entitlementService;
        this.licenseService = licenseService;
    }

    @GetMapping("/entitlements")
    @Operation(summary = "Lấy plan, feature và limit hiện tại")
    @SecurityRequirement(name = "bearerAuth")
    public EntitlementResponse entitlements(
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount user = currentUserService.requireActiveUser(jwt);
        return entitlementService.resolve(user);
    }

    @PostMapping("/license/activate")
    @Operation(summary = "Kích hoạt license key cho tài khoản hiện tại")
    @SecurityRequirement(name = "bearerAuth")
    public EntitlementResponse activateLicense(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody LicenseActivationRequest request
    ) {
        UserAccount user = currentUserService.requireActiveUser(jwt);
        return licenseService.activate(user, request.licenseKey());
    }
}
