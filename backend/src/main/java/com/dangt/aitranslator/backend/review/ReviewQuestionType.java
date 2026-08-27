package com.dangt.aitranslator.backend.review;

/*
 * MEANING:
 * legacy mode, giữ lại để tương thích review cũ.
 *
 * Vocabulary:
 * - WORD_TO_MEANING
 * - MEANING_TO_WORD
 * - READING_TO_WORD
 * - IPA_TO_WORD
 *
 * Grammar:
 * - PATTERN_TO_MEANING
 * - MEANING_TO_PATTERN
 * - EXAMPLE_TO_PATTERN
 */
public enum ReviewQuestionType {

    MEANING,

    WORD_TO_MEANING,

    MEANING_TO_WORD,

    READING_TO_WORD,

    IPA_TO_WORD,

    PATTERN_TO_MEANING,

    MEANING_TO_PATTERN,

    EXAMPLE_TO_PATTERN
}
