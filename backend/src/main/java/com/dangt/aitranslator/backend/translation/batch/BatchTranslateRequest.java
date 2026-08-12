package com.dangt.aitranslator.backend.translation.batch;

import com.dangt.aitranslator.backend.translation.TranslationContextItem;
import com.dangt.aitranslator.backend.translation.TranslationLanguage;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Size;

import java.util.List;

@Schema(
        name = "BatchTranslateRequest",
        description =
                "Dịch nhiều OCR/text blocks trong một AI request. Dùng cho Full Screen, Manga page và Reader."
)
public record BatchTranslateRequest(

        Long profileId,

        @Schema(example = "AUTO")
        TranslationLanguage sourceLanguage,

        @Schema(example = "VI")
        TranslationLanguage targetLanguage,

        @Valid
        @Size(max = 10)
        List<TranslationContextItem> context,

        @Valid
        @Size(min = 1, max = 80)
        List<BatchTranslationBlockRequest> blocks

) {
    public BatchTranslateRequest {
        sourceLanguage =
                sourceLanguage == null
                        ? TranslationLanguage.AUTO
                        : sourceLanguage;

        targetLanguage =
                targetLanguage == null
                        ? TranslationLanguage.VI
                        : targetLanguage;

        context =
                context == null
                        ? List.of()
                        : List.copyOf(context);

        blocks =
                blocks == null
                        ? List.of()
                        : List.copyOf(blocks);
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
