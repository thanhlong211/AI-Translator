package com.dangt.aitranslator.backend.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminStatusUpdateRequest(
        @NotBlank(message = "Trạng thái không được để trống.")
        @Size(max = 30, message = "Trạng thái quá dài.")
        String status,

        @NotBlank(message = "Cần nhập lý do thay đổi.")
        @Size(max = 500, message = "Lý do quá dài.")
        String reason
) {
}
