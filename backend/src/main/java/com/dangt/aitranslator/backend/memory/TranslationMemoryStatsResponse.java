package com.dangt.aitranslator.backend.memory;

public record TranslationMemoryStatsResponse(
        long totalItems,
        long totalHits,
        long usedItems
) {
}
