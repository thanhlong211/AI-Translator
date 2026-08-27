package com.dangt.aitranslator.backend.study;

import java.util.List;

/**
 * DTO CHỈ dùng cho OpenAI Structured Outputs.
 *
 * QUAN TRỌNG:
 * Không đặt Swagger/OpenAPI @Schema hoặc @ArraySchema lên class này.
 *
 * springdoc/swagger-core có thể biến defaultValue mặc định của annotation
 * thành keyword JSON Schema "default". OpenAI Structured Outputs không hỗ trợ
 * keyword "default", nên openai-java sẽ fail local schema validation trước
 * khi request được gửi tới OpenAI.
 *
 * Constraints về số lượng item và format vẫn được enforce bởi:
 * - StudyPromptBuilderService (generation budget)
 * - StudyAnalysisValidator (server-side normalization/limits)
 */
public class StudyStructuredOutput {

    public String original;

    public String reading;

    public String romaji;

    public String translation;

    public String sentenceSummary;

    public List<SentencePart> sentenceParts;

    public List<GrammarPoint> grammar;

    public List<VocabularyItem> vocabulary;

    public List<String> notes;

    public static class SentencePart {
        public String text;
        public String reading;
        public String romaji;
        public String role;
        public String meaning;
        public String explanation;
    }

    public static class GrammarPoint {
        public String pattern;
        public String jlptLevel;
        public String meaning;
        public String matchedText;
        public String explanation;

        public String example;
    }

    public static class VocabularyItem {
        public String surface;
        public String dictionaryForm;
        public String reading;
        public String romaji;
        public String meaning;
        public String partOfSpeech;
        public String jlptLevel;
        public String example;
        public String note;
    }
}
