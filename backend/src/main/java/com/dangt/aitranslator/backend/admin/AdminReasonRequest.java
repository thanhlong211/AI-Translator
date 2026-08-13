package com.dangt.aitranslator.backend.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminReasonRequest(
        @NotBlank(message = "Cần nhập lý do thao tác.")
        @Size(max = 500, message = "Lý do quá dài.")
        String reason
) {
}
