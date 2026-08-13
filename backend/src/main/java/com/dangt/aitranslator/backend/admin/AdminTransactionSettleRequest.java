package com.dangt.aitranslator.backend.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminTransactionSettleRequest(
        @Size(max = 190, message = "Provider reference quá dài.")
        String providerReference,

        @NotBlank(message = "Cần nhập lý do settlement.")
        @Size(max = 500, message = "Lý do quá dài.")
        String reason
) {
}
