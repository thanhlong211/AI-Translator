package com.dangt.aitranslator.backend.study;

import com.dangt.aitranslator.backend.common.AiResponseFormatException;
import com.dangt.aitranslator.backend.common.ApiPerformanceTiming;
import com.dangt.aitranslator.backend.common.RequestCorrelation;
import com.dangt.aitranslator.backend.grammar.GrammarService;
import com.dangt.aitranslator.backend.grammar.GrammarSyncSummary;
import com.dangt.aitranslator.backend.profile.ProfileService;
import com.dangt.aitranslator.backend.profile.TranslationProfile;
import com.dangt.aitranslator.backend.usage.AiProviderUsage;
import com.dangt.aitranslator.backend.usage.AiUsageLedgerService;
import com.dangt.aitranslator.backend.usage.OpenAiUsageExtractor;
import com.dangt.aitranslator.backend.vocabulary.VocabularyService;
import com.dangt.aitranslator.backend.vocabulary.VocabularySyncSummary;
import com.openai.client.OpenAIClient;
import com.openai.models.ChatModel;
import com.openai.models.responses.ResponseCreateParams;
import com.openai.models.responses.StructuredResponse;
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
    private final String studyModelName;
    private final AiUsageLedgerService aiUsageLedgerService;
    private final ProfileService profileService;
    private final StudyPromptBuilderService promptBuilderService;

    private final EnglishStudyPromptBuilderService
            englishPromptBuilderService;

    private final StudyAnalysisValidator validator;

    private final EnglishStudyAnalysisValidator
            englishValidator;

    private final VocabularyService vocabularyService;
    private final GrammarService grammarService;

    public StudyService(
            OpenAIClient openAIClient,

            @Value(
                    "${app.openai.study-model:gpt-4.1-mini}"
            )
            String studyModelName,

            AiUsageLedgerService aiUsageLedgerService,
            ProfileService profileService,

            StudyPromptBuilderService promptBuilderService,

            EnglishStudyPromptBuilderService
                    englishPromptBuilderService,

            StudyAnalysisValidator validator,

            EnglishStudyAnalysisValidator
                    englishValidator,

            VocabularyService vocabularyService,
            GrammarService grammarService
    ) {
        this.openAIClient = openAIClient;
        this.studyModelName =
                studyModelName;
        this.studyModel =
                ChatModel.of(
                        studyModelName
                );
        this.aiUsageLedgerService =
                aiUsageLedgerService;
        this.profileService =
                profileService;
        this.promptBuilderService =
                promptBuilderService;

        this.englishPromptBuilderService =
                englishPromptBuilderService;

        this.validator =
                validator;

        this.englishValidator =
                englishValidator;

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

        /*
         * English dùng schema/prompt/validator riêng.
         * Japanese tiếp tục chạy flow hiện tại phía dưới.
         */
        if (
                request.language()
                        == StudyLanguage.EN
        ) {
            return analyzeEnglish(
                    userId,
                    request,
                    cleanText,
                    profile,
                    requestId,
                    totalStartedAt,
                    profileMs
            );
        }

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

        final long openAiStartedAt =
                stageStartedAt;

        StructuredResponse<StudyStructuredOutput> aiResponse = null;
        StudyStructuredOutput structuredOutput;
        long openAiMs;

        try {
            aiResponse =
                    openAIClient
                            .responses()
                            .create(params);

            structuredOutput =
                    aiResponse
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

            openAiMs =
                    elapsedMs(
                            openAiStartedAt
                    );
        } catch (Exception ex) {
            openAiMs =
                    elapsedMs(
                            openAiStartedAt
                    );

            AiProviderUsage failureUsage =
                    aiResponse == null
                            ? OpenAiUsageExtractor.empty(
                                    studyModelName
                            )
                            : OpenAiUsageExtractor.from(
                                    aiResponse.rawResponse(),
                                    studyModelName
                            );

            aiUsageLedgerService.recordFailure(
                    userId,
                    requestId,
                    "STUDY_ANALYZER",
                    failureUsage,
                    openAiMs,
                    ex
            );

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

            if (ex instanceof AiResponseFormatException formatException) {
                throw formatException;
            }

            throw new AiResponseFormatException(
                    "Không đọc được Structured Study Analysis. Hãy thử lại.",
                    ex
            );
        }

        stageStartedAt =
                System.nanoTime();

        StudyAnalysisPayload normalized;

        try {
            StudyAnalysisPayload parsed =
                    toPayload(
                            structuredOutput
                    );

            normalized =
                    validator
                            .validateAndNormalize(
                                    parsed,
                                    cleanText
                            );
        } catch (RuntimeException ex) {
            aiUsageLedgerService.recordFailure(
                    userId,
                    requestId,
                    "STUDY_ANALYZER",
                    OpenAiUsageExtractor.from(
                            aiResponse.rawResponse(),
                            studyModelName
                    ),
                    openAiMs,
                    ex
            );
            throw ex;
        }

        long parseMs =
                elapsedMs(
                        stageStartedAt
                );

        aiUsageLedgerService.recordSuccess(
                userId,
                requestId,
                "STUDY_ANALYZER",
                OpenAiUsageExtractor.from(
                        aiResponse.rawResponse(),
                        studyModelName
                ),
                openAiMs
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


    private StudyAnalyzeResponse analyzeEnglish(
            Long userId,
            StudyAnalyzeRequest request,
            String cleanText,
            TranslationProfile profile,
            String requestId,
            long totalStartedAt,
            long profileMs
    ) {
        long stageStartedAt =
                System.nanoTime();


        String prompt =
                englishPromptBuilderService
                        .build(
                                profile,
                                cleanText,
                                request.level(),
                                request.context()
                        );


        long promptMs =
                elapsedMs(
                        stageStartedAt
                );


        StructuredResponseCreateParams<
                EnglishStudyStructuredOutput
        > params =
                ResponseCreateParams
                        .builder()
                        .input(prompt)
                        .text(
                                EnglishStudyStructuredOutput.class
                        )
                        .model(studyModel)
                        .build();


        final long openAiStartedAt =
                System.nanoTime();


        StructuredResponse<
                EnglishStudyStructuredOutput
        > aiResponse = null;


        EnglishStudyStructuredOutput
                structuredOutput;


        long openAiMs;


        try {

            aiResponse =
                    openAIClient
                            .responses()
                            .create(params);


            structuredOutput =
                    aiResponse
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
                                            "OpenAI không trả về English Study Analysis."
                                    )
                            );


            openAiMs =
                    elapsedMs(
                            openAiStartedAt
                    );


        } catch (Exception ex) {

            openAiMs =
                    elapsedMs(
                            openAiStartedAt
                    );


            AiProviderUsage failureUsage =
                    aiResponse == null

                            ? OpenAiUsageExtractor
                                    .empty(
                                            studyModelName
                                    )

                            : OpenAiUsageExtractor
                                    .from(
                                            aiResponse
                                                    .rawResponse(),

                                            studyModelName
                                    );


            aiUsageLedgerService
                    .recordFailure(
                            userId,
                            requestId,
                            "STUDY_ANALYZER",
                            failureUsage,
                            openAiMs,
                            ex
                    );


            log.warn(
                    "English Study error requestId={} type={} message={}",
                    requestId,
                    ex.getClass()
                            .getSimpleName(),
                    safeExceptionMessage(
                            ex
                    )
            );


            if (
                    ex instanceof
                            AiResponseFormatException
                            formatException
            ) {
                throw formatException;
            }


            throw new AiResponseFormatException(
                    "Không đọc được English Study Analysis. Hãy thử lại.",
                    ex
            );
        }


        stageStartedAt =
                System.nanoTime();


        StudyAnalysisPayload normalized;


        try {

            normalized =
                    englishValidator
                            .validateAndNormalize(
                                    structuredOutput,
                                    cleanText
                            );


        } catch (RuntimeException ex) {

            aiUsageLedgerService
                    .recordFailure(
                            userId,
                            requestId,
                            "STUDY_ANALYZER",

                            OpenAiUsageExtractor
                                    .from(
                                            aiResponse
                                                    .rawResponse(),
                                            studyModelName
                                    ),

                            openAiMs,
                            ex
                    );

            throw ex;
        }


        long parseMs =
                elapsedMs(
                        stageStartedAt
                );


        aiUsageLedgerService
                .recordSuccess(
                        userId,
                        requestId,
                        "STUDY_ANALYZER",

                        OpenAiUsageExtractor
                                .from(
                                        aiResponse
                                                .rawResponse(),
                                        studyModelName
                                ),

                        openAiMs
                );


        /*
         * Chưa lưu English vào bảng Japanese vocabulary/grammar.
         */
        VocabularySyncSummary vocabularySync =
                VocabularySyncSummary
                        .disabled();


        GrammarSyncSummary grammarSync =
                GrammarSyncSummary
                        .disabled();


        long persistenceMs =
                0L;


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
                "PERF study language=EN requestId={} chars={} grammar={} vocabulary={} collocations={} mistakes={} totalMs={}",
                requestId,
                cleanText.length(),
                normalized
                        .englishGrammar()
                        .size(),
                normalized
                        .englishVocabulary()
                        .size(),
                normalized
                        .collocations()
                        .size(),
                normalized
                        .commonMistakes()
                        .size(),
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
