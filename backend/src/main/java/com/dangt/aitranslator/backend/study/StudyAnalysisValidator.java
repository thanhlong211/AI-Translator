package com.dangt.aitranslator.backend.study;

import com.dangt.aitranslator.backend.common.AiResponseFormatException;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class StudyAnalysisValidator {

    public StudyAnalysisPayload validateAndNormalize(
            StudyAnalysisPayload payload,
            String expectedOriginal
    ) {
        if (payload == null) {
            throw new AiResponseFormatException(
                    "AI không trả về Study Analysis."
            );
        }

        String original =
                clean(payload.original());

        if (original.isBlank()) {
            original =
                    clean(expectedOriginal);
        }

        String translation =
                clean(payload.translation());

        if (translation.isBlank()) {
            throw new AiResponseFormatException(
                    "Study Analysis thiếu bản dịch tiếng Việt."
            );
        }

        return new StudyAnalysisPayload(
                original,
                clean(payload.reading()),
                clean(payload.romaji()),
                translation,
                clean(payload.sentenceSummary()),
                normalizeParts(
                        payload.sentenceParts()
                ),
                normalizeGrammar(
                        payload.grammar(),
                        expectedOriginal
                ),
                normalizeVocabulary(
                        payload.vocabulary(),
                        expectedOriginal
                ),
                normalizeNotes(
                        payload.notes()
                )
        );
    }

    private List<StudySentencePart> normalizeParts(
            List<StudySentencePart> items
    ) {
        if (items == null) {
            return List.of();
        }

        return items
                .stream()
                .filter(item ->
                        item != null &&
                        !clean(item.text()).isBlank()
                )
                .limit(12)
                .map(item ->
                        new StudySentencePart(
                                clean(item.text()),
                                clean(item.reading()),
                                clean(item.romaji()),
                                clean(item.role()),
                                clean(item.meaning()),
                                clean(item.explanation())
                        )
                )
                .toList();
    }

    private List<StudyGrammarPoint> normalizeGrammar(
            List<StudyGrammarPoint> items,
            String expectedOriginal
    ) {
        if (items == null) {
            return List.of();
        }

        String normalizedSource =
                normalizeComparableText(
                        expectedOriginal
                );

        return items
                .stream()
                .filter(item ->
                        item != null
                )
                /*
                 * Japanese Grammar Quality Gate.
                 *
                 * Chỉ giữ grammar point thực sự hữu ích để học.
                 */
                .filter(item ->
                        isUsefulJapaneseGrammar(
                                item,
                                normalizedSource
                        )
                )
                .limit(6)
                .map(item ->
                        new StudyGrammarPoint(
                                clean(item.pattern()),
                                normalizeJlpt(
                                        item.jlptLevel()
                                ),
                                clean(item.meaning()),
                                clean(item.matchedText()),
                                clean(item.explanation()),
                                clean(item.example())
                        )
                )
                .toList();
    }


    private boolean isUsefulJapaneseGrammar(
            StudyGrammarPoint item,
            String normalizedSource
    ) {
        String pattern =
                clean(
                        item.pattern()
                );

        String meaning =
                clean(
                        item.meaning()
                );

        String matchedText =
                clean(
                        item.matchedText()
                );

        String explanation =
                clean(
                        item.explanation()
                );

        String example =
                clean(
                        item.example()
                );


        /*
         * Các field cốt lõi phải đầy đủ.
         *
         * Nếu AI chỉ trả:
         *
         * pattern = じゃ
         * explanation = ...
         *
         * mà thiếu example/matchedText
         * thì không đáng lưu thành grammar point.
         */
        if (
                pattern.isBlank()
                ||
                meaning.isBlank()
                ||
                matchedText.isBlank()
                ||
                explanation.isBlank()
                ||
                example.isBlank()
        ) {
            return false;
        }


        /*
         * Explanation quá ngắn thường chỉ đang
         * lặp lại meaning thay vì giải thích.
         */
        if (
                explanation.length()
                < 18
        ) {
            return false;
        }


        /*
         * matchedText phải thực sự xuất hiện
         * trong câu/đoạn OCR nguồn.
         *
         * Normalize whitespace để source OCR
         * xuống dòng vẫn so sánh được.
         */
        String normalizedMatched =
                normalizeComparableText(
                        matchedText
                );

        if (
                normalizedMatched.isBlank()
                ||
                !normalizedSource.contains(
                        normalizedMatched
                )
        ) {
            return false;
        }


        /*
         * Không lưu các particle / fragment quá cơ bản
         * như một grammar point độc lập.
         *
         * Các tổ hợp thật sự như:
         * 〜てから
         * 〜からといって
         * 〜ので
         * vẫn không bị ảnh hưởng.
         */
        if (
                isTrivialJapanesePattern(
                        pattern
                )
        ) {
            return false;
        }


        return true;
    }


    private boolean isTrivialJapanesePattern(
            String value
    ) {
        String pattern =
                clean(value)
                        .replace(
                                "～",
                                ""
                        )
                        .replace(
                                "〜",
                                ""
                        )
                        .trim();

        return switch (
                pattern
        ) {
            case "は",
                 "が",
                 "を",
                 "に",
                 "へ",
                 "で",
                 "と",
                 "も",
                 "の",
                 "や",
                 "か",
                 "ね",
                 "よ",
                 "な",
                 "じゃ",
                 "では" ->
                    true;

            default ->
                    false;
        };
    }


    private String normalizeComparableText(
            String value
    ) {
        return clean(value)
                .replaceAll(
                        "\\s+",
                        ""
                );
    }

    private List<StudyVocabularyItem> normalizeVocabulary(
            List<StudyVocabularyItem> items,
            String expectedOriginal
    ) {
        if (items == null) {
            return List.of();
        }

        String normalizedSource =
                normalizeComparableText(
                        expectedOriginal
                );

        return items
                .stream()
                .filter(item ->
                        item != null
                )
                .filter(item ->
                        isUsefulJapaneseVocabulary(
                                item,
                                normalizedSource
                        )
                )
                .limit(15)
                .map(item ->
                        new StudyVocabularyItem(
                                clean(item.surface()),
                                clean(item.dictionaryForm()),
                                clean(item.reading()),
                                clean(item.romaji()),
                                clean(item.meaning()),
                                clean(item.partOfSpeech()),
                                normalizeJlpt(
                                        item.jlptLevel()
                                ),
                                clean(item.example()),
                                clean(item.note())
                        )
                )
                .toList();
    }


    private boolean isUsefulJapaneseVocabulary(
            StudyVocabularyItem item,
            String normalizedSource
    ) {
        String surface =
                clean(
                        item.surface()
                );

        String dictionaryForm =
                clean(
                        item.dictionaryForm()
                );

        String reading =
                clean(
                        item.reading()
                );

        String meaning =
                clean(
                        item.meaning()
                );

        String partOfSpeech =
                clean(
                        item.partOfSpeech()
                );

        String example =
                clean(
                        item.example()
                );


        /*
         * Một vocabulary card học tập cần đủ
         * dữ liệu cơ bản.
         */
        if (
                (
                        surface.isBlank()
                        &&
                        dictionaryForm.isBlank()
                )
                ||
                reading.isBlank()
                ||
                meaning.isBlank()
                ||
                partOfSpeech.isBlank()
                ||
                example.isBlank()
        ) {
            return false;
        }


        /*
         * surface là dạng thực sự xuất hiện
         * trong source.
         */
        if (!surface.isBlank()) {
            String normalizedSurface =
                    normalizeComparableText(
                            surface
                    );

            if (
                    normalizedSurface.isBlank()
                    ||
                    !normalizedSource.contains(
                            normalizedSurface
                    )
            ) {
                return false;
            }
        }


        /*
         * Không biến trợ từ/fragment cơ bản
         * thành vocabulary card.
         */
        String key =
                dictionaryForm.isBlank()
                        ? surface
                        : dictionaryForm;

        if (
                isTrivialJapaneseVocabulary(
                        key
                )
        ) {
            return false;
        }


        return true;
    }


    private boolean isTrivialJapaneseVocabulary(
            String value
    ) {
        String word =
                clean(value)
                        .trim();

        return switch (
                word
        ) {
            case "は",
                 "が",
                 "を",
                 "に",
                 "へ",
                 "で",
                 "と",
                 "も",
                 "の",
                 "や",
                 "か",
                 "ね",
                 "よ",
                 "な",
                 "じゃ",
                 "では" ->
                    true;

            default ->
                    false;
        };
    }

    private List<String> normalizeNotes(
            List<String> notes
    ) {
        if (notes == null) {
            return List.of();
        }

        return notes
                .stream()
                .map(this::clean)
                .filter(value ->
                        !value.isBlank()
                )
                .limit(3)
                .toList();
    }

    private String normalizeJlpt(
            String value
    ) {
        String normalized =
                clean(value)
                        .toUpperCase();

        return switch (normalized) {
            case "N5", "N4", "N3", "N2", "N1" ->
                    normalized;
            default ->
                    "UNKNOWN";
        };
    }

    private String clean(String value) {
        return value == null
                ? ""
                : value.trim();
    }
}
