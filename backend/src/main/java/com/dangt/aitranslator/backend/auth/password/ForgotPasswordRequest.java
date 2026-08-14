package com.dangt.aitranslator.backend.auth.password;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ForgotPasswordRequest(
        @Email
        @NotBlank
        @Size(max = 190)
        String email
) {
}
