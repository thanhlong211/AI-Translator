package com.dangt.aitranslator.backend.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

public record RefreshRequest(
        @NotBlank
        @Schema(description = "Opaque refresh token do backend cấp.")
        String refreshToken
) {
}
