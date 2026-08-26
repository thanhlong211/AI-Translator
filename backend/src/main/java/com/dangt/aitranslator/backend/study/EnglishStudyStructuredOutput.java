package com.dangt.aitranslator.backend.study;

import java.util.List;

/**
 * DTO chỉ dùng cho OpenAI Structured Outputs
 * của English Study Mode.
 *
 * Không đặt Swagger/OpenAPI @Schema lên class này.
 */
public class EnglishStudyStructuredOutput {

    public String original;

    /*
     * IPA của toàn câu.
     *
     * Ví dụ:
     * /aɪ hæv bɪn ˈstʌdiɪŋ ˈɪŋɡlɪʃ/
     */
    public String ipa;

    /*
     * Bản dịch tiếng Việt.
     */
    public String translation;

    /*
     * Tóm tắt ngắn về câu.
     */
    public String sentenceSummary;

    /*
     * A1, A2, B1, B2, C1, C2 hoặc UNKNOWN.
     */
    public String cefrLevel;

    public List<SentencePart> sentenceParts;

    public List<GrammarPoint> grammar;

    public List<VocabularyItem> vocabulary;

    public List<CollocationItem> collocations;

    public List<CommonMistake> commonMistakes;

    public List<String> notes;


    public static class SentencePart {

        public String text;

        public String role;

        public String meaning;

        public String explanation;
    }


    public static class GrammarPoint {

        /*
         * Ví dụ:
         * Present Perfect Continuous
         * have/has + been + V-ing
         */
        public String pattern;

        public String cefrLevel;

        public String matchedText;

        public String meaning;

        public String explanation;

        public String example;
    }


    public static class VocabularyItem {

        /*
         * Dạng xuất hiện trong câu.
         */
        public String surface;

        /*
         * Dạng từ điển:
         *
         * studying -> study
         * went -> go
         * children -> child
         */
        public String lemma;

        public String ipa;

        public String meaning;

        public String partOfSpeech;

        public String cefrLevel;

        public String example;

        public String note;
    }


    public static class CollocationItem {

        /*
         * Ví dụ:
         * study English
         * make a decision
         * take responsibility
         */
        public String phrase;

        public String meaning;

        public String example;
    }


    public static class CommonMistake {

        public String incorrect;

        public String correct;

        public String explanation;
    }
}
