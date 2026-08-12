package com.dangt.aitranslator.backend.study;

import com.dangt.aitranslator.backend.common.AiResponseFormatException;
import com.dangt.aitranslator.backend.common.ApiPerformanceTiming;
import com.dangt.aitranslator.backend.common.RequestCorrelation;
import com.dangt.aitranslator.backend.grammar.GrammarService;
import com.dangt.aitranslator.backend.grammar.GrammarSyncSummary;
import com.dangt.aitranslator.backend.profile.ProfileService;
import com.dangt.aitranslator.backend.profile.TranslationProfile;
import com.dangt.aitranslator.backend.vocabulary.VocabularyService;
import com.dangt.aitranslator.backend.vocabulary.VocabularySyncSummary;
import com.openai.client.OpenAIClient;
import com.openai.models.ChatModel;
import com.openai.models.responses.ResponseCreateParams;
import com.openai.models.responses.StructuredResponseCreateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class StudyService {

    private static final Logger log =
            LoggerFactory.getLogger(
                    StudyService.class
            );

    private final OpenAIClient openAIClient;
    private final ChatModel studyModel;
    private final ProfileService profileService;
    private final StudyPromptBuilderService promptBuilderService;
    private final StudyAnalysisValidator validator;
    private final VocabularyService vocabularyService;
    private final GrammarService grammarService;

    public StudyService(
            OpenAIClient openAIClient,

            @Value(
                    "${app.openai.study-model:gpt-4.1-mini}"
            )
            String studyModelName,

            ProfileService profileService,
            StudyPromptBuilderService promptBuilderService,
            StudyAnalysisValidator validator,
            VocabularyService vocabularyService,
            GrammarService grammarService
    ) {
        this.openAIClient = openAIClient;
        this.studyModel =
                ChatModel.of(
                        studyModelName
                );
        this.profileService =
                profileService;
        this.promptBuilderService =
                promptBuilderService;
        this.validator = validator;
        this.vocabularyService =
                vocabularyService;
        this.grammarService =
                grammarService;
    }

    public StudyAnalyzeResponse analyze(
            Long userId,
            StudyAnalyzeRequest request
    ) {
        final String requestId =
                shortRequestId();

        final long totalStartedAt =
                System.nanoTime();

        String cleanText =
                request.text() == null
                        ? ""
                        : request.text().trim();

        if (cleanText.isBlank()) {
            throw new IllegalArgumentException(
                    "Văn bản Study trống."
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

        String prompt =
                promptBuilderService.build(
                        profile,
                        cleanText,
                        request.level(),
                        request.context()
                );

        long promptMs =
                elapsedMs(
                        stageStartedAt
                );

        /*
         * QUAN TRỌNG:
         * .text(StudyStructuredOutput.class) bật Structured Outputs
         * của Responses API. Model không còn tự do trả raw text JSON;
         * OpenAI áp JSON Schema được sinh từ Java class ngay tại API.
         */
        StructuredResponseCreateParams<StudyStructuredOutput> params =
                ResponseCreateParams
                        .builder()
                        .input(prompt)
                        .text(
                                StudyStructuredOutput.class
                        )
                        .model(studyModel)
                        .build();

        stageStartedAt =
                System.nanoTime();

        StudyStructuredOutput structuredOutput;

        try {
            structuredOutput =
                    openAIClient
                            .responses()
                            .create(params)
                            .output()
                            .stream()
                            .flatMap(item ->
                                    item
                                            .message()
                                            .stream()
                            )
                            .flatMap(message ->
                                    message
                                            .content()
                                            .stream()
                            )
                            .flatMap(content ->
                                    content
                                            .outputText()
                                            .stream()
                            )
                            .findFirst()
                            .orElseThrow(() ->
                                    new AiResponseFormatException(
                                            "OpenAI không trả về Structured Study Analysis."
                                    )
                            );
        } catch (AiResponseFormatException ex) {
            throw ex;
        } catch (Exception ex) {
            /*
             * Không log raw model output vì Study có thể chứa nội dung truyện.
             * requestId + exception class đủ để trace production.
             */
            log.warn(
                    "Structured Study response error requestId={} errorType={} message={}",
                    requestId,
                    ex.getClass().getSimpleName(),
                    safeExceptionMessage(ex)
            );

            throw new AiResponseFormatException(
                    "Không đọc được Structured Study Analysis. Hãy thử lại.",
                    ex
            );
        }

        long openAiMs =
                elapsedMs(
                        stageStartedAt
                );

        stageStartedAt =
                System.nanoTime();

        StudyAnalysisPayload parsed =
                toPayload(
                        structuredOutput
                );

        StudyAnalysisPayload normalized =
                validator
                        .validateAndNormalize(
                                parsed,
                                cleanText
                        );

        long parseMs =
                elapsedMs(
                        stageStartedAt
                );

        stageStartedAt =
                System.nanoTime();

        VocabularySyncSummary vocabularySync =
                request.autoSaveVocabulary()
                        ? vocabularyService
                                .recordStudyVocabulary(
                                        userId,
                                        normalized.vocabulary()
                                )
                        : VocabularySyncSummary
                                .disabled();

        GrammarSyncSummary grammarSync =
                request.autoSaveGrammar()
                        ? grammarService
                                .recordStudyGrammar(
                                        userId,
                                        normalized.grammar()
                                )
                        : GrammarSyncSummary
                                .disabled();

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
                        openAiMs,
                        parseMs,
                        persistenceMs,
                        totalMs
                );

        log.info(
                "PERF study requestId={} chars={} context={} parts={} grammar={} vocabulary={} autoSaveVocabulary={} autoSaveGrammar={} profileMs={} promptMs={} openAiMs={} structuredMapMs={} persistenceMs={} totalMs={}",
                requestId,
                cleanText.length(),
                request.context().size(),
                normalized.sentenceParts().size(),
                normalized.grammar().size(),
                normalized.vocabulary().size(),
                request.autoSaveVocabulary(),
                request.autoSaveGrammar(),
                profileMs,
                promptMs,
                openAiMs,
                parseMs,
                persistenceMs,
                totalMs
        );

        return StudyAnalyzeResponse
                .success(
                        normalized,
                        profile,
                        request.level(),
                        vocabularySync,
                        grammarSync,
                        performance
                );
    }

    private StudyAnalysisPayload toPayload(
            StudyStructuredOutput output
    ) {
        if (output == null) {
            throw new AiResponseFormatException(
                    "Structured Study Analysis trống."
            );
        }

        List<StudySentencePart> parts =
                output.sentenceParts == null
                        ? List.of()
                        : output.sentenceParts
                                .stream()
                                .filter(item ->
                                        item != null
                                )
                                .map(item ->
                                        new StudySentencePart(
                                                item.text,
                                                item.reading,
                                                item.romaji,
                                                item.role,
                                                item.meaning,
                                                item.explanation
                                        )
                                )
                                .toList();

        List<StudyGrammarPoint> grammar =
                output.grammar == null
                        ? List.of()
                        : output.grammar
                                .stream()
                                .filter(item ->
                                        item != null
                                )
                                .map(item ->
                                        new StudyGrammarPoint(
                                                item.pattern,
                                                item.jlptLevel,
                                                item.meaning,
                                                item.matchedText,
                                                item.explanation
                                        )
                                )
                                .toList();

        List<StudyVocabularyItem> vocabulary =
                output.vocabulary == null
                        ? List.of()
                        : output.vocabulary
                                .stream()
                                .filter(item ->
                                        item != null
                                )
                                .map(item ->
                                        new StudyVocabularyItem(
                                                item.surface,
                                                item.dictionaryForm,
                                                item.reading,
                                                item.romaji,
                                                item.meaning,
                                                item.partOfSpeech,
                                                item.jlptLevel,
                                                item.note
                                        )
                                )
                                .toList();

        return new StudyAnalysisPayload(
                output.original,
                output.reading,
                output.romaji,
                output.translation,
                output.sentenceSummary,
                parts,
                grammar,
                vocabulary,
                output.notes == null
                        ? List.of()
                        : output.notes
        );
    }

    private String safeExceptionMessage(
            Exception ex
    ) {
        String message =
                ex.getMessage();

        if (
                message == null ||
                message.isBlank()
        ) {
            return "";
        }

        /*
         * SDK structured-output conversion errors có thể chứa JSON raw.
         * Không đưa message dài/raw content vào log production.
         */
        return message.length() > 180
                ? message.substring(0, 180)
                        + "..."
                : message;
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
