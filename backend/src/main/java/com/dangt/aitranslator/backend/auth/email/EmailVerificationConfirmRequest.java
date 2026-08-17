package com.dangt.aitranslator.backend.auth.email;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record EmailVerificationConfirmRequest(
        @NotBlank
        @Email
        @Size(max = 190)
        String email,

        @NotBlank
        @Pattern(regexp = "\\d{6}")
        String code,

        @NotBlank
        @Size(max = 100)
        String deviceId,

        @Size(max = 190)
        String deviceName
) {
}
