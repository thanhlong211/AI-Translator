package com.dangt.aitranslator.backend.auth;

import com.dangt.aitranslator.backend.session.RefreshTokenService;
import io.swagger.v3.oas.annotations.media.Schema;

public record AuthResponse(
        @Schema(example = "true")
        boolean success,

        @Schema(description = "JWT access token")
        String accessToken,

        @Schema(description = "Opaque refresh token. Chỉ trả về lúc login/register/refresh.")
        String refreshToken,

        @Schema(example = "Bearer")
        String tokenType,

        @Schema(example = "900")
        long expiresInSeconds,

        @Schema(example = "2592000")
        long refreshExpiresInSeconds,

        UserSummary user
) {
    public static AuthResponse success(
            JwtService.IssuedToken accessToken,
            RefreshTokenService.IssuedRefreshToken refreshToken,
            UserSummary user
    ) {
        return new AuthResponse(
                true,
                accessToken.value(),
                refreshToken.value(),
                "Bearer",
                accessToken.expiresInSeconds(),
                refreshToken.expiresInSeconds(),
                user
        );
    }
}
