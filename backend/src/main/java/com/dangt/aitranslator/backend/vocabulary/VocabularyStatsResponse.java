package com.dangt.aitranslator.backend.vocabulary;

public record VocabularyStatsResponse(
        long total,
        long newCount,
        long learningCount,
        long knownCount,
        long favoriteCount
) {
}
