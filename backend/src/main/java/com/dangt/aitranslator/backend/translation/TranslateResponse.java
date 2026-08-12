package com.dangt.aitranslator.backend.translation;

import com.dangt.aitranslator.backend.common.ApiPerformanceTiming;
import com.dangt.aitranslator.backend.profile.TranslationProfile;
import io.swagger.v3.oas.annotations.media.Schema;

public record TranslateResponse(

        @Schema(example = "true")
        boolean success,

        Translation translation,

        ResolvedProfile profile,

        AiMetadata ai,

        ApiPerformanceTiming performance

) {

    public static TranslateResponse success(
            String original,
            String translatedText,
            TranslationLanguage sourceLanguage,
            TranslationLanguage targetLanguage,
            TranslationProfile profile,
            String provider,
            String model,
            ApiPerformanceTiming performance
    ) {
        return new TranslateResponse(
                true,
                new Translation(
                        original,
                        translatedText,
                        translatedText,
                        sourceLanguage.name(),
                        targetLanguage.name()
                ),
                new ResolvedProfile(
                        profile.getId(),
                        profile.getName(),
                        profile.getStyle().name(),
                        profile.getUpdatedAt().toString()
                ),
                new AiMetadata(
                        provider,
                        model
                ),
                performance
        );
    }

    public record Translation(
            String original,

            @Schema(description = "Bản dịch theo targetLanguage. Client mới nên dùng field này.")
            String translatedText,

            @Deprecated
            @Schema(
                    description = "Alias legacy để FE hiện tại tiếp tục hoạt động. Giá trị giống translatedText.",
                    deprecated = true
            )
            String vietnamese,

            String sourceLanguage,
            String targetLanguage
    ) {
    }

    public record ResolvedProfile(
            Long id,
            String name,
            String style,
            String updatedAt
    ) {
    }

    public record AiMetadata(
            String provider,
            String model
    ) {
    }
}
