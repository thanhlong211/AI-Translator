package com.dangt.aitranslator.backend.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @Email
        @NotBlank
        @Schema(example = "test@example.com")
        String email,

        @NotBlank
        @Size(min = 8, max = 100)
        @Schema(example = "StrongPassword123!")
        String password,

        @NotBlank
        @Size(max = 100)
        @Schema(example = "desktop-uuid")
        String deviceId,

        @Size(max = 190)
        @Schema(example = "Toan-PC")
        String deviceName
) {
}
