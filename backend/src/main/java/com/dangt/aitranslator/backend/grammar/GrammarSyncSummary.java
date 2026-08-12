package com.dangt.aitranslator.backend.grammar;

public record GrammarSyncSummary(
        boolean autoSaved,
        int inserted,
        int updated,
        int skipped
) {
    public static GrammarSyncSummary disabled() {
        return new GrammarSyncSummary(
                false,
                0,
                0,
                0
        );
    }
}
