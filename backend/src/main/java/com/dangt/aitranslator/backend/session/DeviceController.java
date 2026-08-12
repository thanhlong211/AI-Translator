package com.dangt.aitranslator.backend.session;

import com.dangt.aitranslator.backend.auth.CurrentUserService;
import com.dangt.aitranslator.backend.user.UserAccount;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/me/devices")
@Tag(name = "Devices", description = "Quản lý các phiên đăng nhập theo thiết bị.")
@SecurityRequirement(name = "bearerAuth")
public class DeviceController {

    private final CurrentUserService currentUserService;
    private final RefreshTokenService refreshTokenService;

    public DeviceController(
            CurrentUserService currentUserService,
            RefreshTokenService refreshTokenService
    ) {
        this.currentUserService = currentUserService;
        this.refreshTokenService = refreshTokenService;
    }

    @Operation(summary = "Danh sách thiết bị/phiên đang hoạt động")
    @GetMapping
    public List<DeviceSessionResponse> list(
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount user =
                currentUserService.requireActiveUser(jwt);

        return refreshTokenService.listActiveSessions(
                user.getId(),
                readSessionId(jwt)
        );
    }

    @Operation(summary = "Thu hồi một phiên thiết bị")
    @DeleteMapping("/{sessionId}")
    public void revoke(
            @PathVariable Long sessionId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount user =
                currentUserService.requireActiveUser(jwt);

        refreshTokenService.revokeSession(
                user.getId(),
                sessionId
        );
    }

    private Long readSessionId(Jwt jwt) {
        Object value = jwt.getClaim("sid");

        if (value == null) {
            return null;
        }

        try {
            return Long.parseLong(String.valueOf(value));
        } catch (Exception ex) {
            return null;
        }
    }
}
