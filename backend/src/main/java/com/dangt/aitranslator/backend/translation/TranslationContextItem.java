package com.dangt.aitranslator.backend.translation;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

public record TranslationContextItem(

        @Size(max = 2000)
        @Schema(
                example = "前のセリフ"
        )
        String original,

        @Size(max = 2000)
        @Schema(
                description =
                        "Bản dịch trước theo ngôn ngữ đích hiện tại. Client mới nên dùng field này.",
                example = "Previous translated line"
        )
        String translatedText,

        @Deprecated
        @Size(max = 2000)
        @Schema(
                description =
                        "Field legacy để tương thích FE hiện tại. Sẽ được dùng khi translatedText trống.",
                example = "Câu thoại trước",
                deprecated = true
        )
        String vietnamese

) {
    public String effectiveTranslation() {
        if (
                translatedText != null &&
                !translatedText.isBlank()
        ) {
            return translatedText;
        }

        return vietnamese == null
                ? ""
                : vietnamese;
    }
}
