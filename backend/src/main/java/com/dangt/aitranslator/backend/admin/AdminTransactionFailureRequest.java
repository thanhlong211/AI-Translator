package com.dangt.aitranslator.backend.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminTransactionFailureRequest(
        @Size(max = 100, message = "Failure code quá dài.")
        String failureCode,

        @Size(max = 500, message = "Failure message quá dài.")
        String failureMessage,

        @NotBlank(message = "Cần nhập lý do đánh dấu thất bại.")
        @Size(max = 500, message = "Lý do quá dài.")
        String reason
) {
}
