package com.dangt.aitranslator.backend.profile;

import com.dangt.aitranslator.backend.translation.TranslationLanguage;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record GlossaryEntryRequest(

        @Schema(
                description =
                        "Ngôn ngữ của thuật ngữ nguồn. Omit/null = AUTO để tương thích glossary cũ.",
                example = "JA"
        )
        TranslationLanguage sourceLanguage,

        @Schema(
                description =
                        "Ngôn ngữ của thuật ngữ đích. Omit/null = VI để tương thích glossary cũ.",
                example = "VI"
        )
        TranslationLanguage targetLanguage,

        @NotBlank
        @Size(max = 120)
        @Schema(example = "魔力")
        String source,

        @NotBlank
        @Size(max = 160)
        @Schema(example = "Ma lực")
        String target,

        @Size(max = 500)
        @Schema(
                example =
                        "Luôn dùng Ma lực, không dùng năng lượng ma thuật."
        )
        String note

) {
    public GlossaryEntryRequest {
        sourceLanguage =
                sourceLanguage == null
                        ? TranslationLanguage.AUTO
                        : sourceLanguage;

        targetLanguage =
                targetLanguage == null
                        ? TranslationLanguage.VI
                        : targetLanguage;
    }

    @AssertTrue(
            message =
                    "Glossary targetLanguage không được là AUTO"
    )
    @Schema(hidden = true)
    public boolean isTargetLanguageValid() {
        return targetLanguage != TranslationLanguage.AUTO;
    }
}
