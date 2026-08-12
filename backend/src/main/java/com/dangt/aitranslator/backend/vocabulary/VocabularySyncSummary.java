package com.dangt.aitranslator.backend.vocabulary;

public record VocabularySyncSummary(
        boolean autoSaved,
        int inserted,
        int updated,
        int skipped
) {
    public static VocabularySyncSummary disabled() {
        return new VocabularySyncSummary(
                false,
                0,
                0,
                0
        );
    }
}
