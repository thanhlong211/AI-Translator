package com.dangt.aitranslator.backend.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminSubscriptionCreateRequest(
        @NotBlank(message = "Plan không được để trống.")
        @Size(max = 30, message = "Plan quá dài.")
        String planCode,

        Long priceId,

        @Size(max = 30, message = "Status quá dài.")
        String status,

        String startsAt,
        String endsAt,

        @NotBlank(message = "Cần nhập lý do cấp subscription.")
        @Size(max = 500, message = "Lý do quá dài.")
        String reason
) {
}
