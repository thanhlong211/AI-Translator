package com.dangt.aitranslator.backend.translation;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

@Schema(
        name = "TranslateRequest",
        description =
                "Văn bản OCR + Translation Profile + language pair + context cần dịch."
)
public record TranslateRequest(

        @Schema(
                description =
                        "Văn bản nguồn cần dịch.",
                example = "こんにちは"
        )
        @NotBlank(
                message =
                        "text không được để trống"
        )
        @Size(
                max = 4000,
                message = "text quá dài"
        )
        String text,

        @Schema(
                description =
                        "Profile của user. Nếu null backend dùng Default Profile.",
                example = "1"
        )
        Long profileId,

        @Schema(
                description =
                        "Ngôn ngữ nguồn. Nếu null dùng AUTO để giữ tương thích client cũ.",
                example = "AUTO"
        )
        TranslationLanguage sourceLanguage,

        @Schema(
                description =
                        "Ngôn ngữ đích. Nếu null dùng VI để giữ tương thích client cũ.",
                example = "VI"
        )
        TranslationLanguage targetLanguage,

        @Schema(
                description =
                        "Mục đích gọi /translate để phân loại AI usage. Client cũ mặc định QUICK_TRANSLATE.",
                example = "QUICK_TRANSLATE"
        )
        TranslationPurpose purpose,

        @Valid
        @Size(max = 10)
        @Schema(
                description =
                        "Tối đa 10 câu trước. Backend chỉ dùng số lượng do profile contextLines quy định."
        )
        List<TranslationContextItem> context

) {
    public TranslateRequest {
        sourceLanguage =
                sourceLanguage == null
                        ? TranslationLanguage.AUTO
                        : sourceLanguage;

        targetLanguage =
                targetLanguage == null
                        ? TranslationLanguage.VI
                        : targetLanguage;

        purpose =
                purpose == null
                        ? TranslationPurpose.QUICK_TRANSLATE
                        : purpose;

        context =
                context == null
                        ? List.of()
                        : List.copyOf(context);
    }

    @AssertTrue(
            message =
                    "targetLanguage không được là AUTO"
    )
    @Schema(hidden = true)
    public boolean isTargetLanguageValid() {
        return targetLanguage !=
                TranslationLanguage.AUTO;
    }
}
