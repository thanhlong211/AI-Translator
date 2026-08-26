package com.dangt.aitranslator.backend.study;

public record EnglishStudyGrammarPoint(
        String pattern,
        String cefrLevel,
        String meaning,
        String matchedText,
        String explanation,
        String example
) {
}
