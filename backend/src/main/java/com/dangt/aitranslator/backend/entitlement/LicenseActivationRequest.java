package com.dangt.aitranslator.backend.entitlement;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LicenseActivationRequest(
        @NotBlank(message = "License key không được để trống.")
        @Size(max = 120, message = "License key quá dài.")
        String licenseKey,

        @Size(max = 100, message = "Device ID quá dài.")
        String deviceId
) {
}
