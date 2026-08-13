package com.dangt.aitranslator.backend.translation.batch;

import com.dangt.aitranslator.backend.common.AiResponseFormatException;
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
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class BatchTranslationService {

    private static final Logger log =
            LoggerFactory.getLogger(
                    BatchTranslationService.class
            );

    private static final int MAX_TOTAL_CHARACTERS =
            12_000;

    /**
     * Mapper cục bộ chỉ dùng để parse JSON text do AI trả về.
     * Không inject qua Spring để tránh phụ thuộc Jackson auto-configuration/version.
     */
    private static final ObjectMapper OBJECT_MAPPER =
            new ObjectMapper();

    private final TranslationAiProvider aiProvider;
    private final TranslationUsageService usageService;
    private final AiUsageLedgerService aiUsageLedgerService;
    private final ProfileService profileService;
    private final PromptBuilderService promptBuilderService;
    private final TranslationMemoryService memoryService;

    public BatchTranslationService(
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
        this.promptBuilderService = promptBuilderService;
        this.memoryService = memoryService;
    }

    public BatchTranslateResponse translate(
            Long userId,
            BatchTranslateRequest request
    ) {
        final String requestId =
                shortRequestId();

        final long totalStartedAt =
                System.nanoTime();

        List<BatchTranslationBlockRequest> blocks =
                normalizeAndValidateBlocks(
                        request.blocks()
                );

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

        Map<String, BatchTranslationBlockResponse> resolved =
                new HashMap<>();

        List<BatchTranslationBlockRequest> aiBlocks =
                new ArrayList<>();

        int memoryHits = 0;

        for (BatchTranslationBlockRequest block : blocks) {
            Optional<TranslationMemoryMatch> memoryMatch =
                    memoryService.findExact(
                            userId,
                            profile.getId(),
                            block.text(),
                            request.sourceLanguage(),
                            request.targetLanguage()
                    );

            if (memoryMatch.isPresent()) {
                TranslationMemoryMatch match =
                        memoryMatch.get();

                resolved.put(
                        block.id(),
                        BatchTranslationBlockResponse.memory(
                                block.id(),
                                block.text(),
                                match.translatedText()
                        )
                );

                memoryHits++;
            } else {
                aiBlocks.add(block);
            }
        }

        long promptMs = 0;
        long aiMs = 0;
        long parseMs = 0;
        long persistenceMs = 0;

        String provider =
                aiBlocks.isEmpty()
                        ? "personal-memory"
                        : "";

        String model =
                aiBlocks.isEmpty()
                        ? "exact-match"
                        : "";

        if (!aiBlocks.isEmpty()) {
            stageStartedAt =
                    System.nanoTime();

            String prompt =
                    promptBuilderService
                            .buildBatchTranslationPrompt(
                                    profile,
                                    request.sourceLanguage(),
                                    request.targetLanguage(),
                                    request.purpose(),
                                    request.context(),
                                    aiBlocks
                            );

            promptMs =
                    elapsedMs(
                            stageStartedAt
                    );

            stageStartedAt =
                    System.nanoTime();

            final long aiStartedAt =
                    stageStartedAt;

            TranslationAiResult aiResult = null;
            Map<String, String> parsed;

            try {
                aiResult =
                        aiProvider.translate(
                                prompt
                        );

                aiMs =
                        elapsedMs(
                                aiStartedAt
                        );

                provider =
                        safe(aiResult.provider());
                model =
                        safe(aiResult.model());

                stageStartedAt =
                        System.nanoTime();

                parsed =
                        parseAiTranslations(
                                aiResult.text(),
                                aiBlocks
                        );

                parseMs =
                        elapsedMs(
                                stageStartedAt
                        );

                aiUsageLedgerService.recordSuccess(
                        userId,
                        requestId,
                        request.purpose().name(),
                        aiResult.usage(),
                        aiMs
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

            StringBuilder sourceUsage =
                    new StringBuilder();

            StringBuilder translatedUsage =
                    new StringBuilder();

            for (BatchTranslationBlockRequest block : aiBlocks) {
                String translatedText =
                        parsed.get(
                                block.id()
                        );

                resolved.put(
                        block.id(),
                        BatchTranslationBlockResponse.ai(
                                block.id(),
                                block.text(),
                                translatedText
                        )
                );

                if (!sourceUsage.isEmpty()) {
                    sourceUsage.append('\n');
                    translatedUsage.append('\n');
                }

                sourceUsage.append(
                        block.text()
                );

                translatedUsage.append(
                        translatedText
                );
            }

            stageStartedAt =
                    System.nanoTime();

            usageService
                    .recordSuccessfulTranslation(
                            userId,
                            model,
                            sourceUsage.toString(),
                            translatedUsage.toString()
                    );

            persistenceMs =
                    elapsedMs(
                            stageStartedAt
                    );
        }

        List<BatchTranslationBlockResponse> ordered =
                new ArrayList<>(
                        blocks.size()
                );

        for (BatchTranslationBlockRequest block : blocks) {
            BatchTranslationBlockResponse response =
                    resolved.get(
                            block.id()
                    );

            if (response == null) {
                throw new AiResponseFormatException(
                        "Thiếu bản dịch cho OCR block: "
                                + block.id()
                );
            }

            ordered.add(response);
        }

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
                        parseMs,
                        persistenceMs,
                        totalMs
                );

        log.info(
                "PERF batch-translate requestId={} blocks={} memoryHits={} aiBlocks={} chars={} sourceLanguage={} targetLanguage={} provider={} model={} profileMs={} promptMs={} aiMs={} parseMs={} persistenceMs={} totalMs={}",
                requestId,
                blocks.size(),
                memoryHits,
                aiBlocks.size(),
                blocks.stream()
                        .mapToInt(block -> block.text().length())
                        .sum(),
                request.sourceLanguage(),
                request.targetLanguage(),
                provider,
                model,
                profileMs,
                promptMs,
                aiMs,
                parseMs,
                persistenceMs,
                totalMs
        );

        return BatchTranslateResponse.success(
                ordered,
                request.sourceLanguage(),
                request.targetLanguage(),
                profile,
                provider,
                model,
                memoryHits,
                aiBlocks.size(),
                performance
        );
    }

    private List<BatchTranslationBlockRequest> normalizeAndValidateBlocks(
            List<BatchTranslationBlockRequest> input
    ) {
        if (input == null || input.isEmpty()) {
            throw new IllegalArgumentException(
                    "Batch translation cần ít nhất 1 block."
            );
        }

        if (input.size() > 80) {
            throw new IllegalArgumentException(
                    "Batch translation tối đa 80 blocks."
            );
        }

        Set<String> ids =
                new HashSet<>();

        List<BatchTranslationBlockRequest> result =
                new ArrayList<>(
                        input.size()
                );

        int totalCharacters = 0;

        for (BatchTranslationBlockRequest item : input) {
            if (item == null) {
                throw new IllegalArgumentException(
                        "OCR block không hợp lệ."
                );
            }

            String id =
                    safe(item.id());

            String text =
                    normalizeText(
                            item.text()
                    );

            if (id.isBlank()) {
                throw new IllegalArgumentException(
                        "OCR block thiếu id."
                );
            }

            if (!ids.add(id)) {
                throw new IllegalArgumentException(
                        "OCR block id bị trùng: "
                                + id
                );
            }

            if (text.isBlank()) {
                throw new IllegalArgumentException(
                        "OCR block "
                                + id
                                + " không có text."
                );
            }

            if (text.length() > 1200) {
                throw new IllegalArgumentException(
                        "OCR block "
                                + id
                                + " quá dài."
                );
            }

            totalCharacters +=
                    text.length();

            if (totalCharacters > MAX_TOTAL_CHARACTERS) {
                throw new IllegalArgumentException(
                        "Batch translation vượt quá 12000 ký tự."
                );
            }

            result.add(
                    new BatchTranslationBlockRequest(
                            id,
                            text
                    )
            );
        }

        return List.copyOf(result);
    }

    private Map<String, String> parseAiTranslations(
            String rawOutput,
            List<BatchTranslationBlockRequest> expectedBlocks
    ) {
        String json =
                stripCodeFence(
                        safe(rawOutput)
                );

        if (json.isBlank()) {
            throw new AiResponseFormatException(
                    "AI batch translation trả về nội dung trống."
            );
        }

        final JsonNode root;

        try {
            root =
                    OBJECT_MAPPER.readTree(
                            json
                    );
        } catch (Exception exception) {
            throw new AiResponseFormatException(
                    "AI batch translation không trả về JSON hợp lệ."
            );
        }

        JsonNode translations =
                root.get(
                        "translations"
                );

        if (
                translations == null ||
                !translations.isArray()
        ) {
            throw new AiResponseFormatException(
                    "AI batch translation thiếu translations[]."
            );
        }

        Set<String> expectedIds =
                expectedBlocks
                        .stream()
                        .map(
                                BatchTranslationBlockRequest::id
                        )
                        .collect(
                                java.util.stream.Collectors.toSet()
                        );

        Map<String, String> result =
                new LinkedHashMap<>();

        for (JsonNode item : translations) {
            String id =
                    safe(
                            item.path("id")
                                    .asText("")
                    );

            String translatedText =
                    safe(
                            item.path("translatedText")
                                    .asText("")
                    );

            if (
                    id.isBlank() ||
                    !expectedIds.contains(id)
            ) {
                throw new AiResponseFormatException(
                        "AI batch translation trả về id không hợp lệ: "
                                + id
                );
            }

            if (translatedText.isBlank()) {
                throw new AiResponseFormatException(
                        "AI batch translation trả về bản dịch trống cho: "
                                + id
                );
            }

            if (
                    result.put(
                            id,
                            translatedText
                    ) != null
            ) {
                throw new AiResponseFormatException(
                        "AI batch translation trả về id trùng: "
                                + id
                );
            }
        }

        if (result.size() != expectedIds.size()) {
            Set<String> missing =
                    new HashSet<>(
                            expectedIds
                    );

            missing.removeAll(
                    result.keySet()
            );

            throw new AiResponseFormatException(
                    "AI batch translation thiếu blocks: "
                            + missing
            );
        }

        return result;
    }

    private String stripCodeFence(
            String value
    ) {
        String text =
                safe(value);

        if (!text.startsWith("```")) {
            return text;
        }

        int firstNewline =
                text.indexOf('\n');

        int lastFence =
                text.lastIndexOf("```");

        if (
                firstNewline >= 0 &&
                lastFence > firstNewline
        ) {
            return text
                    .substring(
                            firstNewline + 1,
                            lastFence
                    )
                    .trim();
        }

        return text;
    }

    private String normalizeText(
            String value
    ) {
        return value == null
                ? ""
                : value
                        .replace("\r\n", "\n")
                        .replace('\r', '\n')
                        .trim();
    }

    private String safe(
            String value
    ) {
        return value == null
                ? ""
                : value.trim();
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
