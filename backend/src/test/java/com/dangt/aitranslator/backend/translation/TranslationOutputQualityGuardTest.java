package com.dangt.aitranslator.backend.translation;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TranslationOutputQualityGuardTest {

    @Test
    void acceptsNormalTranslationAndNormalizesLineEndings() {
        String result =
                TranslationOutputQualityGuard
                        .validateAndNormalize(
                                "こんにちは",
                                "\uFEFFXin chào\r\nbạn",
                                TranslationLanguage.JA,
                                TranslationLanguage.VI
                        );

        assertThat(result)
                .isEqualTo(
                        "Xin chào\nbạn"
                );
    }

    @Test
    void rejectsBlankOutput() {
        assertThatThrownBy(() ->
                TranslationOutputQualityGuard
                        .validateAndNormalize(
                                "こんにちは",
                                "   ",
                                TranslationLanguage.JA,
                                TranslationLanguage.VI
                        )
        )
                .isInstanceOf(
                        IllegalStateException.class
                )
                .hasMessageContaining(
                        "không trả về nội dung dịch"
                );
    }

    @Test
    void rejectsMarkdownFence() {
        assertThatThrownBy(() ->
                TranslationOutputQualityGuard
                        .validateAndNormalize(
                                "こんにちは",
                                """
                                ```text
                                Xin chào
                                ```
                                """,
                                TranslationLanguage.JA,
                                TranslationLanguage.VI
                        )
        )
                .isInstanceOf(
                        IllegalStateException.class
                )
                .hasMessageContaining(
                        "markdown"
                );
    }

    @Test
    void rejectsExplicitTranslationWrapper() {
        assertThatThrownBy(() ->
                TranslationOutputQualityGuard
                        .validateAndNormalize(
                                "こんにちは",
                                "Bản dịch: Xin chào",
                                TranslationLanguage.JA,
                                TranslationLanguage.VI
                        )
        )
                .isInstanceOf(
                        IllegalStateException.class
                )
                .hasMessageContaining(
                        "tiền tố giải thích"
                );
    }

    @Test
    void rejectsExtremeTruncationForLongSource() {
        String source =
                "あ".repeat(
                        120
                );

        assertThatThrownBy(() ->
                TranslationOutputQualityGuard
                        .validateAndNormalize(
                                source,
                                "Ngắn",
                                TranslationLanguage.JA,
                                TranslationLanguage.VI
                        )
        )
                .isInstanceOf(
                        IllegalStateException.class
                )
                .hasMessageContaining(
                        "ngắn bất thường"
                );
    }

    @Test
    void rejectsExtremeExpansion() {
        String output =
                "a".repeat(
                        801
                );

        assertThatThrownBy(() ->
                TranslationOutputQualityGuard
                        .validateAndNormalize(
                                "短い",
                                output,
                                TranslationLanguage.JA,
                                TranslationLanguage.VI
                        )
        )
                .isInstanceOf(
                        IllegalStateException.class
                )
                .hasMessageContaining(
                        "dài bất thường"
                );
    }

    @Test
    void allowsIdenticalProperNounOutput() {
        String result =
                TranslationOutputQualityGuard
                        .validateAndNormalize(
                                "東京",
                                "東京",
                                TranslationLanguage.JA,
                                TranslationLanguage.VI
                        );

        assertThat(result)
                .isEqualTo(
                        "東京"
                );
    }
}
