package com.dangt.aitranslator.backend.admin;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotBlank;

public record AdminTransactionCreateRequest(
        @NotNull(message = "User là bắt buộc.")
        Long userId,

        @NotNull(message = "Price là bắt buộc.")
        Long priceId,

        @Size(max = 190, message = "Provider reference quá dài.")
        String providerReference,

        @NotBlank(message = "Cần nhập lý do tạo transaction.")
        @Size(max = 500, message = "Lý do quá dài.")
        String reason
) {
}
