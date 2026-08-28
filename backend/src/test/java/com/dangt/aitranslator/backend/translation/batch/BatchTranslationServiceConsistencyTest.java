package com.dangt.aitranslator.backend.translation.batch;

import com.dangt.aitranslator.backend.common.AiResponseFormatException;
import com.dangt.aitranslator.backend.memory.TranslationMemoryMatch;
import com.dangt.aitranslator.backend.memory.TranslationMemoryService;
import com.dangt.aitranslator.backend.profile.ProfileService;
import com.dangt.aitranslator.backend.profile.PromptBuilderService;
import com.dangt.aitranslator.backend.profile.TranslationProfile;
import com.dangt.aitranslator.backend.profile.TranslationStyle;
import com.dangt.aitranslator.backend.translation.TranslationContextItem;
import com.dangt.aitranslator.backend.translation.TranslationLanguage;
import com.dangt.aitranslator.backend.translation.ai.TranslationAiProvider;
import com.dangt.aitranslator.backend.translation.ai.TranslationAiResult;
import com.dangt.aitranslator.backend.usage.AiUsageLedgerService;
import com.dangt.aitranslator.backend.usage.TranslationUsageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BatchTranslationServiceConsistencyTest {

    private static final Long USER_ID =
            321L;

    @Mock
    private TranslationAiProvider aiProvider;

    @Mock
    private TranslationUsageService usageService;

    @Mock
    private AiUsageLedgerService aiUsageLedgerService;

    @Mock
    private ProfileService profileService;

    @Mock
    private PromptBuilderService promptBuilderService;

    @Mock
    private TranslationMemoryService memoryService;

    private BatchTranslationService service;

    private TranslationProfile profile;


    @BeforeEach
    void setUp() {
        profile =
                new TranslationProfile(
                        USER_ID,
                        "Batch Regression",
                        TranslationStyle.MANGA,
                        10,
                        true,
                        null,
                        false
                );

        when(
                profileService.resolveProfile(
                        USER_ID,
                        null
                )
        ).thenReturn(
                profile
        );

        service =
                new BatchTranslationService(
                        aiProvider,
                        usageService,
                        aiUsageLedgerService,
                        profileService,
                        promptBuilderService,
                        memoryService
                );
    }


    @Test
    void multiBlockBatchBypassesTerminalMemory() {
        BatchTranslateRequest request =
                request(
                        List.of(),
                        List.of(
                                block(
                                        "b1",
                                        "袋はいりますか？"
                                ),
                                block(
                                        "b2",
                                        "大丈夫です"
                                )
                        )
                );

        stubAi(
                request,
                """
                {
                  "translations": [
                    {
                      "id": "b1",
                      "translatedText": "Bạn có cần túi không?"
                    },
                    {
                      "id": "b2",
                      "translatedText": "Không cần đâu."
                    }
                  ]
                }
                """
        );

        BatchTranslateResponse response =
                service.translate(
                        USER_ID,
                        request,
                        true
                );

        assertThat(
                response.summary()
                        .memoryHits()
        ).isZero();

        assertThat(
                response.summary()
                        .aiBlocks()
        ).isEqualTo(
                2
        );

        assertThat(
                response.translations()
        ).hasSize(
                2
        );

        verifyNoInteractions(
                memoryService
        );

        verify(
                aiProvider
        ).translate(
                "test-batch-prompt"
        );
    }


    @Test
    void standaloneSingleBlockStillAllowsPersonalMemory() {
        BatchTranslateRequest request =
                request(
                        List.of(),
                        List.of(
                                block(
                                        "b1",
                                        "大丈夫です"
                                )
                        )
                );

        when(
                memoryService.findExact(
                        USER_ID,
                        null,
                        "大丈夫です",
                        TranslationLanguage.JA,
                        TranslationLanguage.VI
                )
        ).thenReturn(
                Optional.of(
                        new TranslationMemoryMatch(
                                99L,
                                "Tôi ổn.",
                                TranslationLanguage.JA
                        )
                )
        );

        BatchTranslateResponse response =
                service.translate(
                        USER_ID,
                        request,
                        true
                );

        assertThat(
                response.summary()
                        .memoryHits()
        ).isEqualTo(
                1
        );

        assertThat(
                response.summary()
                        .aiBlocks()
        ).isZero();

        assertThat(
                response.ai()
                        .provider()
        ).isEqualTo(
                "personal-memory"
        );

        assertThat(
                response.ai()
                        .model()
        ).isEqualTo(
                "exact-match"
        );

        verifyNoInteractions(
                promptBuilderService,
                aiProvider
        );
    }


    @Test
    void explicitContextBypassesMemoryForSingleBlock() {
        BatchTranslateRequest request =
                request(
                        List.of(
                                new TranslationContextItem(
                                        "袋はいりますか？",
                                        "Bạn có cần túi không?",
                                        null
                                )
                        ),
                        List.of(
                                block(
                                        "b1",
                                        "大丈夫です"
                                )
                        )
                );

        stubAi(
                request,
                """
                {
                  "translations": [
                    {
                      "id": "b1",
                      "translatedText": "Không cần đâu."
                    }
                  ]
                }
                """
        );

        BatchTranslateResponse response =
                service.translate(
                        USER_ID,
                        request,
                        true
                );

        assertThat(
                response.summary()
                        .memoryHits()
        ).isZero();

        assertThat(
                response.summary()
                        .aiBlocks()
        ).isEqualTo(
                1
        );

        verifyNoInteractions(
                memoryService
        );

        verify(
                aiProvider
        ).translate(
                "test-batch-prompt"
        );
    }


    @Test
    void rejectsPerBlockOutputThatViolatesQualityGuard() {
        String source =
                "あ".repeat(
                        120
                );

        BatchTranslateRequest request =
                request(
                        List.of(),
                        List.of(
                                block(
                                        "b1",
                                        source
                                )
                        )
                );

        when(
                memoryService.findExact(
                        USER_ID,
                        null,
                        source,
                        TranslationLanguage.JA,
                        TranslationLanguage.VI
                )
        ).thenReturn(
                Optional.empty()
        );

        stubAi(
                request,
                """
                {
                  "translations": [
                    {
                      "id": "b1",
                      "translatedText": "Ngắn"
                    }
                  ]
                }
                """
        );

        assertThatThrownBy(() ->
                service.translate(
                        USER_ID,
                        request,
                        true
                )
        )
                .isInstanceOf(
                        AiResponseFormatException.class
                )
                .hasMessageContaining(
                        "quality contract"
                )
                .hasMessageContaining(
                        "b1"
                );
    }


    @Test
    void rejectsMarkdownFencedBatchJson() {
        BatchTranslateRequest request =
                request(
                        List.of(),
                        List.of(
                                block(
                                        "b1",
                                        "こんにちは"
                                ),
                                block(
                                        "b2",
                                        "元気ですか？"
                                )
                        )
                );

        stubAi(
                request,
                """
                ```json
                {
                  "translations": [
                    {
                      "id": "b1",
                      "translatedText": "Xin chào"
                    },
                    {
                      "id": "b2",
                      "translatedText": "Bạn khỏe không?"
                    }
                  ]
                }
                ```
                """
        );

        assertThatThrownBy(() ->
                service.translate(
                        USER_ID,
                        request,
                        true
                )
        )
                .isInstanceOf(
                        AiResponseFormatException.class
                )
                .hasMessageContaining(
                        "markdown/code fence"
                );
    }


    private BatchTranslationBlockRequest block(
            String id,
            String text
    ) {
        return new BatchTranslationBlockRequest(
                id,
                text
        );
    }


    private BatchTranslateRequest request(
            List<TranslationContextItem> context,
            List<BatchTranslationBlockRequest> blocks
    ) {
        return new BatchTranslateRequest(
                null,
                BatchTranslationPurpose.MANGA,
                MangaTranslationMode.PANEL,
                TranslationLanguage.JA,
                TranslationLanguage.VI,
                context,
                blocks
        );
    }


    private void stubAi(
            BatchTranslateRequest request,
            String rawOutput
    ) {
        when(
                promptBuilderService
                        .buildBatchTranslationPrompt(
                                eq(profile),
                                eq(
                                        TranslationLanguage.JA
                                ),
                                eq(
                                        TranslationLanguage.VI
                                ),
                                eq(
                                        BatchTranslationPurpose.MANGA
                                ),
                                eq(
                                        request.context()
                                ),
                                anyList()
                        )
        ).thenReturn(
                "test-batch-prompt"
        );

        when(
                aiProvider.translate(
                        "test-batch-prompt"
                )
        ).thenReturn(
                new TranslationAiResult(
                        rawOutput,
                        "test-provider",
                        "test-model",
                        null
                )
        );
    }
}
