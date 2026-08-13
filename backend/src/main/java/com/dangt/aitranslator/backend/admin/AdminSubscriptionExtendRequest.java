package com.dangt.aitranslator.backend.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminSubscriptionExtendRequest(
        @NotBlank(message = "Ngày hết hạn mới là bắt buộc.")
        String endsAt,

        @NotBlank(message = "Cần nhập lý do gia hạn subscription.")
        @Size(max = 500, message = "Lý do quá dài.")
        String reason
) {
}
