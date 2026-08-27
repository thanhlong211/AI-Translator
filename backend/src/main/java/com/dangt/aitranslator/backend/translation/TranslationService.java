package com.dangt.aitranslator.backend.translation;

import com.dangt.aitranslator.backend.common.ApiPerformanceTiming;
import com.dangt.aitranslator.backend.common.RequestCorrelation;
import com.dangt.aitranslator.backend.memory.TranslationMemoryMatch;
import com.dangt.aitranslator.backend.memory.TranslationMemoryService;
import com.dangt.aitranslator.backend.profile.ProfileService;
import com.dangt.aitranslator.backend.profile.PromptBuilderService;
import com.dangt.aitranslator.backend.profile.TranslationProfile;
import com.dangt.aitranslator.backend.translation.ai.TranslationAiProvider;
import com.dangt.aitranslator.backend.translation.ai.TranslationAiResult;
import com.dangt.aitranslator.backend.usage.AiProviderUsage;
import com.dangt.aitranslator.backend.usage.AiUsageLedgerService;
import com.dangt.aitranslator.backend.usage.TranslationUsageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

@Service
public class TranslationService {

    private static final Logger log =
            LoggerFactory.getLogger(
                    TranslationService.class
            );

    private final TranslationAiProvider aiProvider;
    private final TranslationUsageService usageService;
    private final AiUsageLedgerService aiUsageLedgerService;
    private final ProfileService profileService;
    private final PromptBuilderService promptBuilderService;
    private final TranslationMemoryService memoryService;

    public TranslationService(
            TranslationAiProvider aiProvider,
            TranslationUsageService usageService,
            AiUsageLedgerService aiUsageLedgerService,
            ProfileService profileService,
            PromptBuilderService promptBuilderService,
            TranslationMemoryService memoryService
    ) {
        this.aiProvider = aiProvider;
        this.usageService = usageService;
        this.aiUsageLedgerService = aiUsageLedgerService;
        this.profileService = profileService;
        this.promptBuilderService =
                promptBuilderService;
        this.memoryService = memoryService;
    }

    public TranslateResponse translate(
            Long userId,
            TranslateRequest request,
            boolean allowTranslationMemory
    ) {
        final String requestId =
                shortRequestId();

        final long totalStartedAt =
                System.nanoTime();

        String cleanText =
                request.text() == null
                        ? ""
                        : request
                                .text()
                                .trim();

        if (cleanText.isBlank()) {
            throw new IllegalArgumentException(
                    "Văn bản OCR trống."
            );
        }

        long stageStartedAt =
                System.nanoTime();

        TranslationProfile profile =
                profileService
                        .resolveProfile(
                                userId,
                                request.profileId()
                        );

        long profileMs =
                elapsedMs(
                        stageStartedAt
                );

        stageStartedAt =
                System.nanoTime();

        Optional<TranslationMemoryMatch> memoryMatch =
                allowTranslationMemory
                        ? memoryService.findExact(
                                userId,
                                profile.getId(),
                                cleanText,
                                request.sourceLanguage(),
                                request.targetLanguage()
                        )
                        : Optional.empty();

        long memoryMs =
                elapsedMs(
                        stageStartedAt
                );

        if (memoryMatch.isPresent()) {
            TranslationMemoryMatch match =
                    memoryMatch.get();

            long totalMs =
                    elapsedMs(
                            totalStartedAt
                    );

            ApiPerformanceTiming performance =
                    new ApiPerformanceTiming(
                            requestId,
                            profileMs,
                            0,
                            0,
                            0,
                            0,
                            totalMs
                    );

            log.info(
                    "TRANSLATION_MEMORY_HIT requestId={} memoryId={} chars={} sourceLanguage={} matchedSourceLanguage={} targetLanguage={} profileId={} profileMs={} memoryMs={} totalMs={}",
                    requestId,
                    match.memoryId(),
                    cleanText.length(),
                    request.sourceLanguage(),
                    match.matchedSourceLanguage(),
                    request.targetLanguage(),
                    profile.getId(),
                    profileMs,
                    memoryMs,
                    totalMs
            );

            /*
             * No AI provider call and no AI usage event on a personal memory hit.
             * provider/model values are intentionally explicit so old FE can
             * display the result without a response-contract break.
             */
            return TranslateResponse.success(
                    cleanText,
                    match.translatedText(),
                    request.sourceLanguage(),
                    request.targetLanguage(),
                    profile,
                    "personal-memory",
                    "exact-match",
                    performance
            );
        }

        stageStartedAt =
                System.nanoTime();

        String prompt =
                promptBuilderService
                        .buildTranslationPrompt(
                                profile,
                                cleanText,
                                request.sourceLanguage(),
                                request.targetLanguage(),
                                request.context()
                        );

        long promptMs =
                elapsedMs(
                        stageStartedAt
                );

        stageStartedAt =
                System.nanoTime();

        final long aiStartedAt =
                stageStartedAt;

        TranslationAiResult aiResult = null;
        String translatedText;
        long aiMs;
        long aiUsageLedgerMs = 0;

        try {
            aiResult =
                    aiProvider.translate(
                            prompt
                    );

            aiMs =
                    elapsedMs(
                            aiStartedAt
                    );

            translatedText =
                    aiResult.text() == null
                            ? ""
                            : aiResult
                                    .text()
                                    .trim();

            if (translatedText.isBlank()) {
                throw new IllegalStateException(
                        "AI provider không trả về nội dung dịch."
                );
            }

            translatedText =
                    TranslationOutputQualityGuard
                            .validateAndNormalize(
                                    cleanText,
                                    translatedText,
                                    request.sourceLanguage(),
                                    request.targetLanguage()
                            );

            long ledgerStartedAt =
                    System.nanoTime();

            aiUsageLedgerService.recordSuccess(
                    userId,
                    requestId,
                    request.purpose().name(),
                    aiResult.usage(),
                    aiMs
            );

            aiUsageLedgerMs =
                    elapsedMs(
                            ledgerStartedAt
                    );
        } catch (RuntimeException ex) {
            aiMs =
                    elapsedMs(
                            aiStartedAt
                    );

            AiProviderUsage failureUsage =
                    aiResult == null
                            ? new AiProviderUsage(
                                    aiProvider.providerName(),
                                    aiProvider.modelName(),
                                    null,
                                    null,
                                    null,
                                    null,
                                    null
                            )
                            : aiResult.usage();

            aiUsageLedgerService.recordFailure(
                    userId,
                    requestId,
                    request.purpose().name(),
                    failureUsage,
                    aiMs,
                    ex
            );

            throw ex;
        }

        stageStartedAt =
                System.nanoTime();

        usageService
                .recordSuccessfulTranslation(
                        userId,
                        aiResult.model(),
                        cleanText,
                        translatedText
                );

        long persistenceMs =
                elapsedMs(
                        stageStartedAt
                );

        long totalMs =
                elapsedMs(
                        totalStartedAt
                );

        ApiPerformanceTiming performance =
                new ApiPerformanceTiming(
                        requestId,
                        profileMs,
                        promptMs,
                        aiMs,
                        0,
                        persistenceMs,
                        totalMs
                );

        log.info(
                "PERF translate requestId={} chars={} sourceLanguage={} targetLanguage={} provider={} model={} profileMs={} memoryMs={} promptMs={} aiMs={} aiUsageLedgerMs={} persistenceMs={} totalMs={}",
                requestId,
                cleanText.length(),
                request.sourceLanguage(),
                request.targetLanguage(),
                aiResult.provider(),
                aiResult.model(),
                profileMs,
                memoryMs,
                promptMs,
                aiMs,
                aiUsageLedgerMs,
                persistenceMs,
                totalMs
        );

        return TranslateResponse.success(
                cleanText,
                translatedText,
                request.sourceLanguage(),
                request.targetLanguage(),
                profile,
                aiResult.provider(),
                aiResult.model(),
                performance
        );
    }

    private long elapsedMs(
            long startedAt
    ) {
        return Math.max(
                0,
                (
                        System.nanoTime()
                        -
                        startedAt
                )
                /
                1_000_000L
        );
    }

    private String shortRequestId() {
        String correlated =
                RequestCorrelation
                        .currentId();

        if (!correlated.isBlank()) {
            return correlated;
        }

        return UUID
                .randomUUID()
                .toString();
    }
}
