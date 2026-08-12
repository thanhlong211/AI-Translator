package com.dangt.aitranslator.backend.memory;

import com.dangt.aitranslator.backend.translation.TranslationLanguage;

import java.time.Instant;

public record TranslationMemoryResponse(
        Long id,
        Long profileId,
        String sourceText,
        String correctedTranslation,
        TranslationLanguage sourceLanguage,
        TranslationLanguage targetLanguage,
        long hitCount,
        Instant lastUsedAt,
        Instant createdAt,
        Instant updatedAt
) {
    public static TranslationMemoryResponse from(
            TranslationMemory memory
    ) {
        return new TranslationMemoryResponse(
                memory.getId(),
                memory.getProfileId(),
                memory.getSourceText(),
                memory.getCorrectedTranslation(),
                memory.getSourceLanguage(),
                memory.getTargetLanguage(),
                memory.getHitCount(),
                memory.getLastUsedAt(),
                memory.getCreatedAt(),
                memory.getUpdatedAt()
        );
    }
}
