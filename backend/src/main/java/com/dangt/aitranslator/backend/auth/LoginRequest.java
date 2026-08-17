package com.dangt.aitranslator.backend.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest(
        @Email
        @NotBlank
        @Schema(example = "test@example.com")
        String email,

        @NotBlank
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
