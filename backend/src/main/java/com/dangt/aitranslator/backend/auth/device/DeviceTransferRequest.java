package com.dangt.aitranslator.backend.auth.device;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DeviceTransferRequest(
        @Email
        @NotBlank
        @Size(max = 190)
        String email,

        @NotBlank
        @Size(max = 100)
        String deviceId,

        @Size(max = 190)
        String deviceName
) {
}
