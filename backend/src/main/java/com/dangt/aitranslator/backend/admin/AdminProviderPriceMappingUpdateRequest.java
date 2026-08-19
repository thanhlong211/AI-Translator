package com.dangt.aitranslator.backend.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AdminProviderPriceMappingUpdateRequest(
        @Size(max = 190)
        String providerProductId,

        @NotBlank(message = "Provider price ID không được để trống.")
        @Size(max = 190, message = "Provider price ID quá dài.")
        String providerPriceId,

        @NotNull(message = "Trạng thái active là bắt buộc.")
        Boolean active,

        @NotBlank(message = "Cần nhập lý do thay đổi mapping.")
        @Size(max = 500, message = "Lý do quá dài.")
        String reason
) {
}
