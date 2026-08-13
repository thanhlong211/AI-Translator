package com.dangt.aitranslator.backend.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminPlanUpdateRequest(
        @NotBlank(message = "Plan không được để trống.")
        @Size(max = 30, message = "Plan quá dài.")
        String planCode,

        String expiresAt,

        @NotBlank(message = "Cần nhập lý do thay đổi plan.")
        @Size(max = 500, message = "Lý do quá dài.")
        String reason
) {
}
