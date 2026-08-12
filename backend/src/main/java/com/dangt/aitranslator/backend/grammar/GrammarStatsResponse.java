package com.dangt.aitranslator.backend.grammar;

public record GrammarStatsResponse(
        long total,
        long newCount,
        long learningCount,
        long knownCount,
        long favoriteCount
) {
}
