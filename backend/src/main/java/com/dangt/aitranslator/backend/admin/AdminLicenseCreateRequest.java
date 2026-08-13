package com.dangt.aitranslator.backend.admin;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminLicenseCreateRequest(
        @NotBlank(message = "Plan không được để trống.")
        @Size(max = 30, message = "Plan quá dài.")
        String planCode,

        @NotBlank(message = "Duration type không được để trống.")
        @Size(max = 30, message = "Duration type quá dài.")
        String durationType,

        @Min(value = 1, message = "Số activation tối đa phải từ 1.")
        @Max(value = 10000, message = "Số activation tối đa quá lớn.")
        int maxActivations,

        String startsAt,
        String expiresAt,

        @Size(max = 500, message = "Ghi chú quá dài.")
        String note,

        @NotBlank(message = "Cần nhập lý do tạo license.")
        @Size(max = 500, message = "Lý do quá dài.")
        String reason
) {
}
