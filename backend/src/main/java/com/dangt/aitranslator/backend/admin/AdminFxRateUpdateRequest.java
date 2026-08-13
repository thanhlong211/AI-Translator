package com.dangt.aitranslator.backend.admin;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record AdminFxRateUpdateRequest(
        @NotBlank(message = "Base currency không được để trống.")
        @Size(min = 3, max = 3, message = "Base currency phải là mã ISO 3 ký tự.")
        String baseCurrency,

        @NotBlank(message = "Quote currency không được để trống.")
        @Size(min = 3, max = 3, message = "Quote currency phải là mã ISO 3 ký tự.")
        String quoteCurrency,

        @NotNull(message = "FX rate là bắt buộc.")
        @DecimalMin(value = "0.000000000001", message = "FX rate phải lớn hơn 0.")
        @Digits(integer = 12, fraction = 12, message = "FX rate vượt độ chính xác cho phép.")
        BigDecimal rate,

        Boolean active,
        String effectiveFrom,
        String effectiveTo,

        @Size(max = 500, message = "Ghi chú quá dài.")
        String notes,

        @NotBlank(message = "Cần nhập lý do sửa FX rate.")
        @Size(max = 500, message = "Lý do quá dài.")
        String reason
) {
}
