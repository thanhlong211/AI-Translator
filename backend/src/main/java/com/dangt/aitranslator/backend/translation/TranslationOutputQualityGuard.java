package com.dangt.aitranslator.backend.translation;

import java.util.regex.Pattern;

/**
 * Deterministic guard for a single /translate AI response.
 *
 * This class deliberately does NOT try to judge translation semantics.
 * It only rejects clear response-contract violations or extremely
 * suspicious truncation / hallucination shapes.
 *
 * No second AI call is performed here.
 */
public final class TranslationOutputQualityGuard {

    private static final Pattern FORBIDDEN_PREFIX =
            Pattern.compile(
                    "^(?:bản\\s+dịch|translation|translated\\s+text)\\s*[:：]",
                    Pattern.CASE_INSENSITIVE
                            | Pattern.UNICODE_CASE
            );

    private TranslationOutputQualityGuard() {
    }

    public static String validateAndNormalize(
            String sourceText,
            String translatedText,
            TranslationLanguage sourceLanguage,
            TranslationLanguage targetLanguage
    ) {
        String source =
                normalizeSource(
                        sourceText
                );

        String output =
                normalizeOutput(
                        translatedText
                );

        if (output.isBlank()) {
            throw new IllegalStateException(
                    "AI provider không trả về nội dung dịch."
            );
        }

        /*
         * Prompt explicitly forbids markdown.
         *
         * Do not silently strip fences because doing so would hide
         * provider contract regressions.
         */
        if (output.contains("```")) {
            throw new IllegalStateException(
                    "AI provider trả về markdown thay vì bản dịch thuần."
            );
        }

        /*
         * Reject common assistant wrappers.
         *
         * This intentionally targets only very explicit wrappers;
         * normal ':' characters inside translated prose are allowed.
         */
        if (
                FORBIDDEN_PREFIX
                        .matcher(output)
                        .find()
        ) {
            throw new IllegalStateException(
                    "AI provider trả về tiền tố giải thích thay vì bản dịch thuần."
            );
        }

        int sourceChars =
                meaningfulLength(
                        source
                );

        int outputChars =
                meaningfulLength(
                        output
                );

        /*
         * Very conservative truncation guard.
         *
         * A translation can naturally be much shorter than its source,
         * especially between CJK and Latin-script languages.
         * Therefore only extreme ratios are rejected.
         */
        if (
                sourceChars >= 120
                &&
                outputChars <
                        Math.max(
                                8,
                                sourceChars / 15
                        )
        ) {
            throw new IllegalStateException(
                    "Kết quả dịch ngắn bất thường so với văn bản nguồn."
            );
        }

        /*
         * Very conservative expansion / hallucination guard.
         *
         * Short source text gets a generous absolute allowance so
         * legitimate localized phrases are not rejected.
         */
        int maximumReasonableLength =
                Math.max(
                        800,
                        sourceChars * 10 + 200
                );

        if (
                outputChars >
                        maximumReasonableLength
        ) {
            throw new IllegalStateException(
                    "Kết quả dịch dài bất thường so với văn bản nguồn."
            );
        }

        /*
         * Same source/output is not rejected.
         *
         * Proper nouns, product names, symbols, already-target-language
         * input and AUTO detection can legitimately produce identical
         * output.
         */
        return output;
    }

    private static String normalizeSource(
            String value
    ) {
        if (value == null) {
            return "";
        }

        return value
                .replace("\r\n", "\n")
                .replace('\r', '\n')
                .strip();
    }

    private static String normalizeOutput(
            String value
    ) {
        if (value == null) {
            return "";
        }

        String result =
                value
                        .replace("\r\n", "\n")
                        .replace('\r', '\n')
                        .strip();

        /*
         * Defensive removal of a Unicode BOM is safe and does not
         * change translation semantics.
         */
        if (
                result.startsWith(
                        "\uFEFF"
                )
        ) {
            result =
                    result
                            .substring(1)
                            .strip();
        }

        return result;
    }

    private static int meaningfulLength(
            String value
    ) {
        int count = 0;

        for (
                int index = 0;
                index < value.length();
                index++
        ) {
            if (
                    !Character.isWhitespace(
                            value.charAt(index)
                    )
            ) {
                count++;
            }
        }

        return count;
    }
}
