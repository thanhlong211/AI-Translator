package com.dangt.aitranslator.backend.admin;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record AdminAiModelCostCreateRequest(
        @NotBlank(message = "Provider không được để trống.")
        @Size(max = 50, message = "Provider quá dài.")
        String provider,

        @NotBlank(message = "Model không được để trống.")
        @Size(max = 120, message = "Model quá dài.")
        String model,

        @NotBlank(message = "Currency không được để trống.")
        @Size(min = 3, max = 3, message = "Currency phải là mã ISO 3 ký tự.")
        String currency,

        @NotNull(message = "Input cost là bắt buộc.")
        @DecimalMin(value = "0", message = "Input cost không được âm.")
        @Digits(integer = 12, fraction = 8, message = "Input cost vượt độ chính xác cho phép.")
        BigDecimal inputCostPerMillion,

        @NotNull(message = "Cached input cost là bắt buộc.")
        @DecimalMin(value = "0", message = "Cached input cost không được âm.")
        @Digits(integer = 12, fraction = 8, message = "Cached input cost vượt độ chính xác cho phép.")
        BigDecimal cachedInputCostPerMillion,

        @NotNull(message = "Output cost là bắt buộc.")
        @DecimalMin(value = "0", message = "Output cost không được âm.")
        @Digits(integer = 12, fraction = 8, message = "Output cost vượt độ chính xác cho phép.")
        BigDecimal outputCostPerMillion,

        Boolean active,
        String effectiveFrom,
        String effectiveTo,

        @Size(max = 500, message = "Ghi chú quá dài.")
        String notes,

        @NotBlank(message = "Cần nhập lý do tạo cost configuration.")
        @Size(max = 500, message = "Lý do quá dài.")
        String reason
) {
}
