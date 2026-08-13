package com.dangt.aitranslator.backend.admin;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.Map;

public record AdminPlanDefinitionUpdateRequest(
        @NotBlank(message = "Tên hiển thị không được để trống.")
        @Size(max = 80, message = "Tên hiển thị quá dài.")
        String displayName,

        @Size(max = 500, message = "Mô tả plan quá dài.")
        String description,

        @NotNull(message = "Rank là bắt buộc.")
        @Min(value = 0, message = "Rank không được âm.")
        @Max(value = 100000, message = "Rank quá lớn.")
        Integer rankOrder,

        @NotNull(message = "Trạng thái active là bắt buộc.")
        Boolean active,

        Map<String, Boolean> features,
        Map<String, Long> limits,

        @NotBlank(message = "Cần nhập lý do thay đổi plan.")
        @Size(max = 500, message = "Lý do quá dài.")
        String reason
) {
}
