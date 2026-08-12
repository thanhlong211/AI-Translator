package com.dangt.aitranslator.backend.memory;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TranslationMemoryUpdateRequest(
        @NotBlank(message = "correctedTranslation không được để trống")
        @Size(max = 12000, message = "correctedTranslation quá dài")
        String correctedTranslation
) {
}
