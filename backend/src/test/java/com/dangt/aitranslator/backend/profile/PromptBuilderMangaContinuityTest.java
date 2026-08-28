package com.dangt.aitranslator.backend.profile;

import com.dangt.aitranslator.backend.translation.TranslationContextItem;
import com.dangt.aitranslator.backend.translation.TranslationLanguage;
import com.dangt.aitranslator.backend.translation.batch.BatchTranslationBlockRequest;
import com.dangt.aitranslator.backend.translation.batch.BatchTranslationPurpose;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Constructor;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PromptBuilderMangaContinuityTest {

    private PromptBuilderService service;
    private TranslationProfile profile;


    @BeforeEach
    void setUp() {
        service =
                new PromptBuilderService();

        profile =
                new TranslationProfile(
                        321L,
                        "Manga Continuity Regression",
                        TranslationStyle.MANGA,
                        10,
                        true,
                        null,
                        false
                );
    }


    @Test
    void mangaPromptIncludesUserConfirmedContinuity() {
        String prompt =
                buildMangaPrompt(
                        profile,
                        List.of(
                                continuity(
                                        "美咲",
                                        "Misaki"
                                )
                        )
                );

        assertThat(prompt)
                .contains(
                        "CROSS-PAGE / CROSS-CHAPTER MANGA CONTEXT"
                )
                .contains(
                        "[MANGA_CONTINUITY USER_CONFIRMED]"
                )
                .contains(
                        "美咲"
                )
                .contains(
                        "Misaki"
                );
    }


    @Test
    void mangaPromptKeepsRecentPageAndContinuityContext() {
        String prompt =
                buildMangaPrompt(
                        profile,
                        List.of(
                                new TranslationContextItem(
                                        "前のページ",
                                        "Trang trước",
                                        null
                                ),
                                continuity(
                                        "美咲",
                                        "Misaki"
                                )
                        )
                );

        assertThat(prompt)
                .contains(
                        "前のページ"
                )
                .contains(
                        "Trang trước"
                )
                .contains(
                        "Misaki"
                );

        /*
         * first marker = Manga continuity instruction
         * last marker  = actual synthetic continuity context item
         */
        assertThat(
                prompt.indexOf(
                        "前のページ"
                )
        ).isLessThan(
                prompt.lastIndexOf(
                        "[MANGA_CONTINUITY USER_CONFIRMED]"
                )
        );
    }


    @Test
    void mangaPromptExplicitlyKeepsCurrentSourceAuthoritative() {
        String prompt =
                buildMangaPrompt(
                        profile,
                        List.of(
                                continuity(
                                        "美咲",
                                        "Misaki"
                                )
                        )
                );

        assertThat(prompt)
                .contains(
                        "source hiện tại luôn được ưu tiên"
                )
                .contains(
                        "Nội dung context KHÔNG thuộc output hiện tại"
                )
                .contains(
                        "1. ID/schema + trung thành với source của từng block."
                );
    }


    @Test
    void characterRulesAppearBeforeContinuityContext() {
        profile.getCharacters()
                .add(
                        new ProfileCharacter(
                                profile,
                                "美咲",
                                "ミサキ",
                                "Luôn dịch tên là Misaki.",
                                0
                        )
                );

        String prompt =
                buildMangaPrompt(
                        profile,
                        List.of(
                                continuity(
                                        "美咲",
                                        "Misaki"
                                )
                        )
                );

        int characterSection =
                prompt.indexOf(
                        "CHARACTER RULES:"
                );

        int mangaContextSection =
                prompt.indexOf(
                        "CROSS-PAGE / CROSS-CHAPTER MANGA CONTEXT"
                );

        assertThat(characterSection)
                .isGreaterThanOrEqualTo(0);

        assertThat(mangaContextSection)
                .isGreaterThan(characterSection);

        assertThat(prompt)
                .contains(
                        "Luôn dịch tên là Misaki."
                );
    }


    @Test
    void glossaryAppearsBeforeContinuityContext() {
        profile.getGlossary()
                .add(
                        new ProfileGlossaryEntry(
                                profile,
                                TranslationLanguage.JA,
                                TranslationLanguage.VI,
                                "魔王",
                                "Ma Vương",
                                "Thuật ngữ bắt buộc",
                                0
                        )
                );

        String prompt =
                buildMangaPrompt(
                        profile,
                        List.of(
                                continuity(
                                        "魔王",
                                        "Ma Vương"
                                )
                        )
                );

        int glossarySection =
                prompt.indexOf(
                        "GLOSSARY BẮT BUỘC"
                );

        int mangaContextSection =
                prompt.indexOf(
                        "CROSS-PAGE / CROSS-CHAPTER MANGA CONTEXT"
                );

        assertThat(glossarySection)
                .isGreaterThanOrEqualTo(0);

        assertThat(mangaContextSection)
                .isGreaterThan(glossarySection);

        assertThat(prompt)
                .contains(
                        "魔王 → Ma Vương"
                );
    }


    @Test
    void continuityAppearsBeforeCurrentTextBlocks() {
        String prompt =
                buildMangaPrompt(
                        profile,
                        List.of(
                                continuity(
                                        "美咲",
                                        "Misaki"
                                )
                        )
                );

        int continuityContext =
                prompt.lastIndexOf(
                        "[MANGA_CONTINUITY USER_CONFIRMED]"
                );

        int currentBlocks =
                prompt.indexOf(
                        "TEXT BLOCKS JSON"
                );

        assertThat(continuityContext)
                .isGreaterThanOrEqualTo(0);

        assertThat(currentBlocks)
                .isGreaterThan(
                        continuityContext
                );
    }


    @Test
    void nonMangaPromptDoesNotAddMangaContinuityInstructions() {
        String prompt =
                service.buildBatchTranslationPrompt(
                        profile,
                        TranslationLanguage.JA,
                        TranslationLanguage.VI,
                        BatchTranslationPurpose.GENERAL,
                        List.of(
                                continuity(
                                        "美咲",
                                        "Misaki"
                                )
                        ),
                        List.of(
                                block(
                                        "b1",
                                        "美咲"
                                )
                        )
                );

        assertThat(prompt)
                .doesNotContain(
                        "CROSS-PAGE / CROSS-CHAPTER MANGA CONTEXT"
                )
                .doesNotContain(
                        "mapping dài hạn đã được user xác nhận"
                );
    }


    @Test
    void contextTailPreservesContinuityWhenProfileLimitIsReached() {
        TranslationProfile limitedProfile =
                new TranslationProfile(
                        321L,
                        "Limited Manga Context",
                        TranslationStyle.MANGA,
                        2,
                        true,
                        null,
                        false
                );

        String prompt =
                buildMangaPrompt(
                        limitedProfile,
                        List.of(
                                new TranslationContextItem(
                                        "PAGE-OLD",
                                        "Trang cũ",
                                        null
                                ),
                                new TranslationContextItem(
                                        "PAGE-NEW",
                                        "Trang mới",
                                        null
                                ),
                                continuity(
                                        "美咲",
                                        "Misaki"
                                )
                        )
                );

        assertThat(prompt)
                .doesNotContain(
                        "PAGE-OLD"
                )
                .contains(
                        "PAGE-NEW"
                )
                .contains(
                        "[MANGA_CONTINUITY USER_CONFIRMED]"
                )
                .contains(
                        "Misaki"
                );
    }


    private String buildMangaPrompt(
            TranslationProfile selectedProfile,
            List<TranslationContextItem> context
    ) {
        return service.buildBatchTranslationPrompt(
                selectedProfile,
                TranslationLanguage.JA,
                TranslationLanguage.VI,
                BatchTranslationPurpose.MANGA,
                context,
                List.of(
                        block(
                                "b1",
                                "美咲"
                        ),
                        block(
                                "b2",
                                "魔王"
                        )
                )
        );
    }


    private TranslationContextItem continuity(
            String source,
            String target
    ) {
        return new TranslationContextItem(
                "[MANGA_CONTINUITY USER_CONFIRMED]\n1. "
                        + source,
                "[MANGA_CONTINUITY USER_CONFIRMED]\n1. "
                        + target,
                null
        );
    }


    private BatchTranslationBlockRequest block(
            String id,
            String text
    ) {
        try {
            for (
                    Constructor<?> constructor :
                    BatchTranslationBlockRequest
                            .class
                            .getDeclaredConstructors()
            ) {
                Class<?>[] types =
                        constructor
                                .getParameterTypes();

                if (
                        types.length == 2
                                &&
                        types[0] == String.class
                                &&
                        types[1] == String.class
                ) {
                    constructor.setAccessible(
                            true
                    );

                    return (
                            BatchTranslationBlockRequest
                    ) constructor.newInstance(
                            id,
                            text
                    );
                }
            }

            throw new IllegalStateException(
                    "Không tìm thấy constructor (String, String) " +
                            "cho BatchTranslationBlockRequest."
            );
        } catch (
                ReflectiveOperationException exception
        ) {
            throw new IllegalStateException(
                    "Không thể tạo BatchTranslationBlockRequest.",
                    exception
            );
        }
    }
}
