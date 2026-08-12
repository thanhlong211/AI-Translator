package com.dangt.aitranslator.backend.feedback;

import com.dangt.aitranslator.backend.translation.TranslationLanguage;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TranslationFeedbackRequest(

        Long profileId,

        @NotBlank
        @Size(max = 4000)
        String sourceText,

        @NotBlank
        @Size(max = 8000)
        String aiTranslation,

        @NotBlank
        @Size(max = 8000)
        String correctedTranslation,

        TranslationLanguage sourceLanguage,

        TranslationLanguage targetLanguage,

        @Size(max = 80)
        String provider,

        @Size(max = 120)
        String model,

        @Size(max = 120)
        String requestId,

        @Schema(
                description = "Chỉ true khi user chủ động đồng ý dùng correction cho việc cải thiện/fine-tune model.",
                defaultValue = "false"
        )
        boolean allowModelImprovement
) {
    public TranslationFeedbackRequest {
        sourceLanguage = sourceLanguage == null
                ? TranslationLanguage.AUTO
                : sourceLanguage;

        targetLanguage = targetLanguage == null
                ? TranslationLanguage.VI
                : targetLanguage;

        if (targetLanguage == TranslationLanguage.AUTO) {
            throw new IllegalArgumentException(
                    "targetLanguage không được là AUTO."
            );
        }
    }
}
