package com.dangt.aitranslator.backend.translation;

import com.dangt.aitranslator.backend.memory.TranslationMemoryMatch;
import com.dangt.aitranslator.backend.memory.TranslationMemoryService;
import com.dangt.aitranslator.backend.profile.ProfileService;
import com.dangt.aitranslator.backend.profile.PromptBuilderService;
import com.dangt.aitranslator.backend.profile.TranslationProfile;
import com.dangt.aitranslator.backend.profile.TranslationStyle;
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
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TranslationServiceMemoryContextTest {

    private static final Long USER_ID =
            123L;

    private static final String SOURCE =
            "大丈夫です";

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

    private TranslationService service;

    private TranslationProfile profile;

    @BeforeEach
    void setUp() {
        profile =
                new TranslationProfile(
                        USER_ID,
                        "Regression Test",
                        TranslationStyle.NATURAL,
                        5,
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
                new TranslationService(
                        aiProvider,
                        usageService,
                        aiUsageLedgerService,
                        profileService,
                        promptBuilderService,
                        memoryService
                );
    }

    @Test
    void noContextAllowsTerminalPersonalMemoryHit() {
        TranslateRequest request =
                request(
                        List.of()
                );

        when(
                memoryService.findExact(
                        USER_ID,
                        null,
                        SOURCE,
                        TranslationLanguage.JA,
                        TranslationLanguage.VI
                )
        ).thenReturn(
                Optional.of(
                        new TranslationMemoryMatch(
                                77L,
                                "Tôi ổn.",
                                TranslationLanguage.JA
                        )
                )
        );

        TranslateResponse response =
                service.translate(
                        USER_ID,
                        request,
                        true
                );

        assertThat(
                response.translation()
                        .translatedText()
        ).isEqualTo(
                "Tôi ổn."
        );

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
                aiProvider,
                aiUsageLedgerService,
                usageService
        );
    }

    @Test
    void meaningfulContextBypassesTerminalMemoryAndUsesAi() {
        List<TranslationContextItem> context =
                List.of(
                        new TranslationContextItem(
                                "袋はいりますか？",
                                "Bạn có cần túi không?",
                                null
                        )
                );

        TranslateRequest request =
                request(
                        context
                );

        stubAi(
                request,
                "Không cần đâu."
        );

        TranslateResponse response =
                service.translate(
                        USER_ID,
                        request,
                        true
                );

        assertThat(
                response.translation()
                        .translatedText()
        ).isEqualTo(
                "Không cần đâu."
        );

        assertThat(
                response.ai()
                        .provider()
        ).isEqualTo(
                "test-provider"
        );

        verifyNoInteractions(
                memoryService
        );

        verify(
                promptBuilderService
        ).buildTranslationPrompt(
                profile,
                SOURCE,
                TranslationLanguage.JA,
                TranslationLanguage.VI,
                request.context()
        );

        verify(
                aiProvider
        ).translate(
                "test-prompt"
        );
    }

    @Test
    void blankPlaceholderContextStillAllowsMemoryHit() {
        TranslateRequest request =
                request(
                        List.of(
                                new TranslationContextItem(
                                        "   ",
                                        "",
                                        null
                                )
                        )
                );

        when(
                memoryService.findExact(
                        USER_ID,
                        null,
                        SOURCE,
                        TranslationLanguage.JA,
                        TranslationLanguage.VI
                )
        ).thenReturn(
                Optional.of(
                        new TranslationMemoryMatch(
                                88L,
                                "Tôi ổn.",
                                TranslationLanguage.JA
                        )
                )
        );

        TranslateResponse response =
                service.translate(
                        USER_ID,
                        request,
                        true
                );

        assertThat(
                response.ai()
                        .provider()
        ).isEqualTo(
                "personal-memory"
        );

        verifyNoInteractions(
                promptBuilderService,
                aiProvider
        );
    }

    @Test
    void disabledTranslationMemoryNeverPerformsLookup() {
        TranslateRequest request =
                request(
                        List.of()
                );

        stubAi(
                request,
                "Tôi ổn."
        );

        TranslateResponse response =
                service.translate(
                        USER_ID,
                        request,
                        false
                );

        assertThat(
                response.ai()
                        .provider()
        ).isEqualTo(
                "test-provider"
        );

        verifyNoInteractions(
                memoryService
        );

        verify(
                aiProvider
        ).translate(
                "test-prompt"
        );
    }

    private TranslateRequest request(
            List<TranslationContextItem> context
    ) {
        return new TranslateRequest(
                SOURCE,
                null,
                TranslationLanguage.JA,
                TranslationLanguage.VI,
                TranslationPurpose.QUICK_TRANSLATE,
                context
        );
    }

    private void stubAi(
            TranslateRequest request,
            String translatedText
    ) {
        when(
                promptBuilderService
                        .buildTranslationPrompt(
                                profile,
                                SOURCE,
                                TranslationLanguage.JA,
                                TranslationLanguage.VI,
                                request.context()
                        )
        ).thenReturn(
                "test-prompt"
        );

        when(
                aiProvider.translate(
                        "test-prompt"
                )
        ).thenReturn(
                new TranslationAiResult(
                        translatedText,
                        "test-provider",
                        "test-model",
                        null
                )
        );
    }
}
