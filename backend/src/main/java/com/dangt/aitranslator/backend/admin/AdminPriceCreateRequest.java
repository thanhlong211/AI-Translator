package com.dangt.aitranslator.backend.admin;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AdminPriceCreateRequest(
        @NotBlank(message = "Plan không được để trống.")
        @Size(max = 30, message = "Plan quá dài.")
        String planCode,

        @NotBlank(message = "Chu kỳ giá không được để trống.")
        @Size(max = 30, message = "Chu kỳ giá quá dài.")
        String billingPeriod,

        @NotBlank(message = "Currency không được để trống.")
        @Size(min = 3, max = 3, message = "Currency phải là mã ISO 3 ký tự.")
        String currency,

        @NotNull(message = "Giá bán là bắt buộc.")
        @Min(value = 0, message = "Giá bán không được âm.")
        Long amountMinor,

        @Min(value = 0, message = "Giá niêm yết không được âm.")
        Long compareAtAmountMinor,

        Boolean active,
        Boolean sellable,
        String startsAt,
        String endsAt,

        @NotBlank(message = "Cần nhập lý do tạo giá.")
        @Size(max = 500, message = "Lý do quá dài.")
        String reason
) {
}
