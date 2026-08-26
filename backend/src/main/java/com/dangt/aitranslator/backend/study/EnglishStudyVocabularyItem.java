package com.dangt.aitranslator.backend.study;

public record EnglishStudyVocabularyItem(
        String surface,
        String lemma,
        String ipa,
        String meaning,
        String partOfSpeech,
        String cefrLevel,
        String example,
        String note
) {
}
