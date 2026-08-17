package com.dangt.aitranslator.backend.auth.email;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record EmailVerificationRequest(
        @NotBlank
        @Email
        @Size(max = 190)
        String email
) {
}
