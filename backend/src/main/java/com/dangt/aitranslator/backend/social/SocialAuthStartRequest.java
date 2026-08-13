package com.dangt.aitranslator.backend.social;

import jakarta.validation.constraints.Size;

public record SocialAuthStartRequest(
        @Size(max = 100) String deviceId,
        @Size(max = 190) String deviceName
) {
}
