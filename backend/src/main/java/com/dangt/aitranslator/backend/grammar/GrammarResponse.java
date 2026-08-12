package com.dangt.aitranslator.backend.grammar;

import java.time.Instant;

public record GrammarResponse(
        Long id,
        String pattern,
        String jlptLevel,
        String meaning,
        String explanation,
        GrammarStatus status,
        boolean favorite,
        int encounterCount,
        String personalNote,
        Instant firstSeenAt,
        Instant lastSeenAt,
        Instant createdAt,
        Instant updatedAt
) {
    public static GrammarResponse from(
            UserGrammar grammar
    ) {
        return new GrammarResponse(
                grammar.getId(),
                grammar.getPattern(),
                grammar.getJlptLevel(),
                grammar.getMeaning(),
                grammar.getExplanation(),
                grammar.getStatus(),
                grammar.isFavorite(),
                grammar.getEncounterCount(),
                grammar.getPersonalNote(),
                grammar.getFirstSeenAt(),
                grammar.getLastSeenAt(),
                grammar.getCreatedAt(),
                grammar.getUpdatedAt()
        );
    }
}
