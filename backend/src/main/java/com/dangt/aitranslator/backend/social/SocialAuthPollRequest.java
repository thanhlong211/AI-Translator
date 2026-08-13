package com.dangt.aitranslator.backend.social;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SocialAuthPollRequest(
        @NotBlank @Size(max = 200) String pollSecret
) {
}
