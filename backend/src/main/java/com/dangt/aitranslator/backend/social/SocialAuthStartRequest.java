package com.dangt.aitranslator.backend.social;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SocialAuthStartRequest(
        @NotBlank
        @Size(max = 100)
        String deviceId,

        @Size(max = 190)
        String deviceName
) {
}
