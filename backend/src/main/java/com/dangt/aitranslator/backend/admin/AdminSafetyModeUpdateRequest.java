package com.dangt.aitranslator.backend.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminSafetyModeUpdateRequest(
        @NotBlank(message = "Mode không được để trống.")
        @Size(max = 20, message = "Mode quá dài.")
        String mode,

        @NotBlank(message = "Cần nhập lý do thay đổi safety mode.")
        @Size(max = 500, message = "Lý do quá dài.")
        String reason,

        @NotBlank(message = "Cần nhập confirmation phrase.")
        @Size(max = 80, message = "Confirmation phrase quá dài.")
        String confirmation
) {
}
