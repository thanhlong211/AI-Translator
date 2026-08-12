package com.dangt.aitranslator.backend.translation.batch;

import com.dangt.aitranslator.backend.common.ApiPerformanceTiming;
import com.dangt.aitranslator.backend.profile.TranslationProfile;
import com.dangt.aitranslator.backend.translation.TranslationLanguage;

import java.util.List;

public record BatchTranslateResponse(
        boolean success,
        List<BatchTranslationBlockResponse> translations,
        LanguagePair languagePair,
        ResolvedProfile profile,
        AiMetadata ai,
        Summary summary,
        ApiPerformanceTiming performance
) {
    public static BatchTranslateResponse success(
            List<BatchTranslationBlockResponse> translations,
            TranslationLanguage sourceLanguage,
            TranslationLanguage targetLanguage,
            TranslationProfile profile,
            String provider,
            String model,
            int memoryHits,
            int aiBlocks,
            ApiPerformanceTiming performance
    ) {
        return new BatchTranslateResponse(
                true,
                List.copyOf(translations),
                new LanguagePair(
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
                new Summary(
                        translations.size(),
                        memoryHits,
                        aiBlocks
                ),
                performance
        );
    }

    public record LanguagePair(
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

    public record Summary(
            int totalBlocks,
            int memoryHits,
            int aiBlocks
    ) {
    }
}
