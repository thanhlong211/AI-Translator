package com.dangt.aitranslator.backend.review;

import com.dangt.aitranslator.backend.study.StudyLanguage;
import com.dangt.aitranslator.backend.grammar.GrammarStatus;
import com.dangt.aitranslator.backend.grammar.UserGrammar;
import com.dangt.aitranslator.backend.grammar.UserGrammarRepository;
import com.dangt.aitranslator.backend.vocabulary.UserVocabulary;
import com.dangt.aitranslator.backend.vocabulary.UserVocabularyRepository;
import com.dangt.aitranslator.backend.vocabulary.VocabularyStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Stream;

@Service
public class ReviewService {

    private final UserVocabularyRepository vocabularyRepository;
    private final UserGrammarRepository grammarRepository;
    private final ReviewEventRepository reviewEventRepository;
    private final ReviewSchedulerService scheduler;
    private final ReviewMasteryService masteryService;

    public ReviewService(
            UserVocabularyRepository vocabularyRepository,
            UserGrammarRepository grammarRepository,
            ReviewEventRepository reviewEventRepository,
            ReviewSchedulerService scheduler,
            ReviewMasteryService masteryService
    ) {
        this.vocabularyRepository =
                vocabularyRepository;
        this.grammarRepository =
                grammarRepository;
        this.reviewEventRepository =
                reviewEventRepository;
        this.scheduler =
                scheduler;
        this.masteryService =
                masteryService;
    }

    @Transactional(readOnly = true)
    public ReviewQueueResponse due(
            Long userId,
            int limit
    ) {
        return due(
                userId,
                StudyLanguage.JA,
                limit
        );
    }

    @Transactional(readOnly = true)
    public ReviewQueueResponse due(
            Long userId,
            StudyLanguage language,
            int limit
    ) {
        StudyLanguage safeLanguage =
                normalizeLanguage(language);

        int safeLimit =
                Math.max(
                        1,
                        Math.min(
                                100,
                                limit
                        )
                );

        Instant now =
                Instant.now();

        List<UserVocabulary> dueVocabulary =
                vocabularyRepository
                        .findTop100ByUserIdAndLanguageAndDueAtLessThanEqualOrderByDueAtAsc(
                                userId,
                                safeLanguage,
                                now
                        );

        List<UserGrammar> dueGrammar =
                grammarRepository
                        .findTop100ByUserIdAndLanguageAndDueAtLessThanEqualOrderByDueAtAsc(
                                userId,
                                safeLanguage,
                                now
                        );

        List<UserVocabulary> vocabularyPool =
                vocabularyRepository
                        .findTop500ByUserIdAndLanguageOrderByLastSeenAtDesc(
                                userId,
                                safeLanguage
                        );

        List<UserGrammar> grammarPool =
                grammarRepository
                        .findTop500ByUserIdAndLanguageOrderByLastSeenAtDesc(
                                userId,
                                safeLanguage
                        );

        List<ReviewItemResponse> items =
                Stream.concat(
                                dueVocabulary
                                        .stream()
                                        .map(
                                                item ->
                                                        toReviewItem(
                                                                item,
                                                                vocabularyPool
                                                        )
                                        ),
                                dueGrammar
                                        .stream()
                                        .map(
                                                item ->
                                                        toReviewItem(
                                                                item,
                                                                grammarPool
                                                        )
                                        )
                        )
                        .sorted(
                                Comparator
                                        .comparing(
                                                (
                                                        ReviewItemResponse item
                                                ) ->
                                                        !item.quizReady()
                                        )
                                        .thenComparing(
                                                ReviewItemResponse::dueAt
                                        )
                                        .thenComparing(
                                                item ->
                                                        item.itemType()
                                                                .name()
                                        )
                                        .thenComparing(
                                                ReviewItemResponse::itemId
                                        )
                        )
                        .limit(
                                safeLimit
                        )
                        .toList();

        long vocabularyDue =
                vocabularyRepository
                        .countByUserIdAndLanguageAndDueAtLessThanEqual(
                                userId,
                                safeLanguage,
                                now
                        );

        long grammarDue =
                grammarRepository
                        .countByUserIdAndLanguageAndDueAtLessThanEqual(
                                userId,
                                safeLanguage,
                                now
                        );

        return new ReviewQueueResponse(
                items,
                vocabularyDue + grammarDue,
                vocabularyDue,
                grammarDue
        );
    }

    @Transactional(readOnly = true)
    public ReviewQueueResponse practice(
            Long userId,
            int limit
    ) {
        return practice(
                userId,
                StudyLanguage.JA,
                limit
        );
    }

    @Transactional(readOnly = true)
    public ReviewQueueResponse practice(
            Long userId,
            StudyLanguage language,
            int limit
    ) {
        StudyLanguage safeLanguage =
                normalizeLanguage(language);

        int safeLimit =
                Math.max(
                        1,
                        Math.min(
                                100,
                                limit
                        )
                );

        List<UserVocabulary> vocabularyPool =
                vocabularyRepository
                        .findTop500ByUserIdAndLanguageOrderByLastSeenAtDesc(
                                userId,
                                safeLanguage
                        );

        List<UserGrammar> grammarPool =
                grammarRepository
                        .findTop500ByUserIdAndLanguageOrderByLastSeenAtDesc(
                                userId,
                                safeLanguage
                        );

        List<ReviewItemResponse> candidates =
                Stream.concat(
                                vocabularyPool
                                        .stream()
                                        .map(
                                                item ->
                                                        toReviewItem(
                                                                item,
                                                                vocabularyPool
                                                        )
                                        ),
                                grammarPool
                                        .stream()
                                        .map(
                                                item ->
                                                        toReviewItem(
                                                                item,
                                                                grammarPool
                                                        )
                                        )
                        )
                        .filter(
                                ReviewItemResponse::quizReady
                        )
                        .sorted(
                                Comparator
                                        .comparingInt(
                                                (
                                                        ReviewItemResponse item
                                                ) ->
                                                        practiceMasteryPriority(
                                                                item.masteryLevel()
                                                        )
                                        )
                                        .thenComparingInt(
                                                ReviewItemResponse::accuracyPercent
                                        )
                                        .thenComparing(
                                                Comparator
                                                        .comparingInt(
                                                                ReviewItemResponse::wrongCount
                                                        )
                                                        .reversed()
                                        )
                                        .thenComparing(
                                                ReviewItemResponse::itemId
                                        )
                        )
                        .limit(
                                safeLimit
                        )
                        .toList();

        long vocabularyCount =
                candidates.stream()
                        .filter(
                                item ->
                                        item.itemType()
                                                ==
                                        ReviewItemType.VOCABULARY
                        )
                        .count();

        long grammarCount =
                candidates.size()
                -
                vocabularyCount;

        return new ReviewQueueResponse(
                candidates,
                candidates.size(),
                vocabularyCount,
                grammarCount
        );
    }

    @Transactional(readOnly = true)
    public ReviewStatsResponse stats(
            Long userId
    ) {
        return stats(
                userId,
                StudyLanguage.JA
        );
    }

    @Transactional(readOnly = true)
    public ReviewStatsResponse stats(
            Long userId,
            StudyLanguage language
    ) {
        StudyLanguage safeLanguage =
                normalizeLanguage(language);

        Instant now =
                Instant.now();

        Instant since =
                now.minus(
                        24,
                        ChronoUnit.HOURS
                );

        long vocabularyDue =
                vocabularyRepository
                        .countByUserIdAndLanguageAndDueAtLessThanEqual(
                                userId,
                                safeLanguage,
                                now
                        );

        long grammarDue =
                grammarRepository
                        .countByUserIdAndLanguageAndDueAtLessThanEqual(
                                userId,
                                safeLanguage,
                                now
                        );

        long correct =
                reviewEventRepository
                        .countByUserIdAndLanguageAndCorrectTrueAndReviewedAtGreaterThanEqual(
                                userId,
                                safeLanguage,
                                since
                        );

        long wrong =
                reviewEventRepository
                        .countByUserIdAndLanguageAndCorrectFalseAndReviewedAtGreaterThanEqual(
                                userId,
                                safeLanguage,
                                since
                        );

        long reviewed =
                correct + wrong;

        int accuracy =
                reviewed <= 0
                        ? 0
                        : (int) Math.round(
                                (
                                        (double) correct
                                        /
                                        (double) reviewed
                                )
                                *
                                100.0
                        );

        return new ReviewStatsResponse(
                vocabularyDue + grammarDue,
                vocabularyDue,
                grammarDue,
                reviewed,
                correct,
                wrong,
                accuracy,

                reviewEventRepository
                        .countByUserIdAndLanguageAndGradeAndReviewedAtGreaterThanEqual(
                                userId,
                                safeLanguage,
                                ReviewGrade.AGAIN,
                                since
                        ),

                reviewEventRepository
                        .countByUserIdAndLanguageAndGradeAndReviewedAtGreaterThanEqual(
                                userId,
                                safeLanguage,
                                ReviewGrade.HARD,
                                since
                        ),

                reviewEventRepository
                        .countByUserIdAndLanguageAndGradeAndReviewedAtGreaterThanEqual(
                                userId,
                                safeLanguage,
                                ReviewGrade.GOOD,
                                since
                        ),

                reviewEventRepository
                        .countByUserIdAndLanguageAndGradeAndReviewedAtGreaterThanEqual(
                                userId,
                                safeLanguage,
                                ReviewGrade.EASY,
                                since
                        )
        );
    }

    @Transactional
    public ReviewAnswerResponse answer(
            Long userId,
            ReviewAnswerRequest request
    ) {
        if (
                request.itemId() == null ||
                request.itemId() <= 0
        ) {
            throw new IllegalArgumentException(
                    "Review item ID không hợp lệ."
            );
        }

        Instant now =
                Instant.now();

        if (request.practice()) {
            return switch (
                    request.itemType()
            ) {
                case VOCABULARY ->
                        answerVocabularyPractice(
                                userId,
                                request
                        );

                case GRAMMAR ->
                        answerGrammarPractice(
                                userId,
                                request
                        );
            };
        }

        return switch (
                request.itemType()
        ) {
            case VOCABULARY ->
                    answerVocabulary(
                            userId,
                            request,
                            now
                    );

            case GRAMMAR ->
                    answerGrammar(
                            userId,
                            request,
                            now
                    );
        };
    }

    private ReviewAnswerResponse answerVocabularyPractice(
            Long userId,
            ReviewAnswerRequest request
    ) {
        UserVocabulary item =
                vocabularyRepository
                        .findByIdAndUserId(
                                request.itemId(),
                                userId
                        )
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "Không tìm thấy từ vựng để ôn."
                                )
                        );

        ReviewQuestionType questionType =
                normalizeVocabularyQuestionType(
                        request.questionType(),
                        item
                );

        long selectedId =
                selectedItemId(
                        request.selectedOptionId(),
                        ReviewItemType.VOCABULARY
                );

        validateVocabularyOption(
                userId,
                selectedId,
                item.getLanguage()
        );

        boolean correct =
                selectedId ==
                item.getId();

        ReviewMasteryLevel mastery =
                masteryService.level(
                        item.getReviewCorrectCount(),
                        item.getReviewWrongCount(),
                        item.getCorrectStreak()
                );

        int accuracy =
                masteryService
                        .accuracyPercent(
                                item.getReviewCorrectCount(),
                                item.getReviewWrongCount()
                        );

        ReviewGrade informationalGrade =
                masteryService
                        .automaticGrade(
                                correct,
                                item.getReviewCorrectCount(),
                                item.getReviewWrongCount(),
                                item.getCorrectStreak()
                        );

        return new ReviewAnswerResponse(
                true,
                correct,
                true,
                informationalGrade,
                mastery,
                accuracy,
                vocabularyOptionText(
                        item,
                        questionType
                ),
                ReviewItemResponse.from(
                        item,
                        questionType,
                        List.of(),
                        mastery,
                        accuracy
                )
        );
    }

    private ReviewAnswerResponse answerGrammarPractice(
            Long userId,
            ReviewAnswerRequest request
    ) {
        UserGrammar item =
                grammarRepository
                        .findByIdAndUserId(
                                request.itemId(),
                                userId
                        )
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "Không tìm thấy ngữ pháp để ôn."
                                )
                        );

        ReviewQuestionType questionType =
                normalizeGrammarQuestionType(
                        request.questionType(),
                        item
                );

        long selectedId =
                selectedItemId(
                        request.selectedOptionId(),
                        ReviewItemType.GRAMMAR
                );

        validateGrammarOption(
                userId,
                selectedId,
                item.getLanguage()
        );

        boolean correct =
                selectedId ==
                item.getId();

        ReviewMasteryLevel mastery =
                masteryService.level(
                        item.getReviewCorrectCount(),
                        item.getReviewWrongCount(),
                        item.getCorrectStreak()
                );

        int accuracy =
                masteryService
                        .accuracyPercent(
                                item.getReviewCorrectCount(),
                                item.getReviewWrongCount()
                        );

        ReviewGrade informationalGrade =
                masteryService
                        .automaticGrade(
                                correct,
                                item.getReviewCorrectCount(),
                                item.getReviewWrongCount(),
                                item.getCorrectStreak()
                        );

        return new ReviewAnswerResponse(
                true,
                correct,
                true,
                informationalGrade,
                mastery,
                accuracy,
                grammarOptionText(
                        item,
                        questionType
                ),
                ReviewItemResponse.from(
                        item,
                        questionType,
                        List.of(),
                        mastery,
                        accuracy
                )
        );
    }

    private ReviewAnswerResponse answerVocabulary(
            Long userId,
            ReviewAnswerRequest request,
            Instant now
    ) {
        UserVocabulary item =
                vocabularyRepository
                        .findByIdAndUserId(
                                request.itemId(),
                                userId
                        )
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "Không tìm thấy từ vựng để ôn."
                                )
                        );

        ReviewQuestionType questionType =
                normalizeVocabularyQuestionType(
                        request.questionType(),
                        item
                );

        long selectedId =
                selectedItemId(
                        request.selectedOptionId(),
                        ReviewItemType.VOCABULARY
                );

        validateVocabularyOption(
                userId,
                selectedId,
                item.getLanguage()
        );

        boolean correct =
                selectedId ==
                item.getId();

        int previousInterval =
                item.getIntervalDays();

        double previousEase =
                item.getEaseFactor();

        item.recordQuizResult(
                correct
        );

        ReviewGrade automaticGrade =
                masteryService
                        .automaticGrade(
                                correct,
                                item.getReviewCorrectCount(),
                                item.getReviewWrongCount(),
                                item.getCorrectStreak()
                        );

        ReviewSchedule next =
                scheduler.next(
                        item.getIntervalDays(),
                        item.getEaseFactor(),
                        item.getRepetitions(),
                        item.getLapseCount(),
                        automaticGrade,
                        now
                );

        VocabularyStatus nextStatus =
                vocabularyStatus(
                        automaticGrade,
                        next.repetitions()
                );

        item.applyReviewSchedule(
                next.dueAt(),
                next.intervalDays(),
                next.easeFactor(),
                next.repetitions(),
                next.lapseCount(),
                nextStatus,
                now
        );

        UserVocabulary saved =
                vocabularyRepository
                        .saveAndFlush(
                                item
                        );

        ReviewMasteryLevel mastery =
                masteryService.level(
                        saved.getReviewCorrectCount(),
                        saved.getReviewWrongCount(),
                        saved.getCorrectStreak()
                );

        int accuracy =
                masteryService
                        .accuracyPercent(
                                saved.getReviewCorrectCount(),
                                saved.getReviewWrongCount()
                        );

        reviewEventRepository.save(
                new ReviewEvent(
                        userId,
                        item.getLanguage(),
                        ReviewItemType.VOCABULARY,
                        item.getId(),
                        automaticGrade,
                        questionType,
                        correct,
                        request.responseTimeMs(),
                        previousInterval,
                        next.intervalDays(),
                        previousEase,
                        next.easeFactor(),
                        now
                )
        );

        return new ReviewAnswerResponse(
                true,
                correct,
                false,
                automaticGrade,
                mastery,
                accuracy,
                vocabularyOptionText(
                        saved,
                        questionType
                ),
                ReviewItemResponse.from(
                        saved,
                        questionType,
                        List.of(),
                        mastery,
                        accuracy
                )
        );
    }

    private ReviewAnswerResponse answerGrammar(
            Long userId,
            ReviewAnswerRequest request,
            Instant now
    ) {
        UserGrammar item =
                grammarRepository
                        .findByIdAndUserId(
                                request.itemId(),
                                userId
                        )
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "Không tìm thấy ngữ pháp để ôn."
                                )
                        );

        ReviewQuestionType questionType =
                normalizeGrammarQuestionType(
                        request.questionType(),
                        item
                );

        long selectedId =
                selectedItemId(
                        request.selectedOptionId(),
                        ReviewItemType.GRAMMAR
                );

        validateGrammarOption(
                userId,
                selectedId,
                item.getLanguage()
        );

        boolean correct =
                selectedId ==
                item.getId();

        int previousInterval =
                item.getIntervalDays();

        double previousEase =
                item.getEaseFactor();

        item.recordQuizResult(
                correct
        );

        ReviewGrade automaticGrade =
                masteryService
                        .automaticGrade(
                                correct,
                                item.getReviewCorrectCount(),
                                item.getReviewWrongCount(),
                                item.getCorrectStreak()
                        );

        ReviewSchedule next =
                scheduler.next(
                        item.getIntervalDays(),
                        item.getEaseFactor(),
                        item.getRepetitions(),
                        item.getLapseCount(),
                        automaticGrade,
                        now
                );

        GrammarStatus nextStatus =
                grammarStatus(
                        automaticGrade,
                        next.repetitions()
                );

        item.applyReviewSchedule(
                next.dueAt(),
                next.intervalDays(),
                next.easeFactor(),
                next.repetitions(),
                next.lapseCount(),
                nextStatus,
                now
        );

        UserGrammar saved =
                grammarRepository
                        .saveAndFlush(
                                item
                        );

        ReviewMasteryLevel mastery =
                masteryService.level(
                        saved.getReviewCorrectCount(),
                        saved.getReviewWrongCount(),
                        saved.getCorrectStreak()
                );

        int accuracy =
                masteryService
                        .accuracyPercent(
                                saved.getReviewCorrectCount(),
                                saved.getReviewWrongCount()
                        );

        reviewEventRepository.save(
                new ReviewEvent(
                        userId,
                        item.getLanguage(),
                        ReviewItemType.GRAMMAR,
                        item.getId(),
                        automaticGrade,
                        questionType,
                        correct,
                        request.responseTimeMs(),
                        previousInterval,
                        next.intervalDays(),
                        previousEase,
                        next.easeFactor(),
                        now
                )
        );

        return new ReviewAnswerResponse(
                true,
                correct,
                false,
                automaticGrade,
                mastery,
                accuracy,
                grammarOptionText(
                        saved,
                        questionType
                ),
                ReviewItemResponse.from(
                        saved,
                        questionType,
                        List.of(),
                        mastery,
                        accuracy
                )
        );
    }

    private ReviewItemResponse toReviewItem(
            UserVocabulary item,
            List<UserVocabulary> pool
    ) {
        ReviewMasteryLevel mastery =
                masteryService.level(
                        item.getReviewCorrectCount(),
                        item.getReviewWrongCount(),
                        item.getCorrectStreak()
                );

        int accuracy =
                masteryService
                        .accuracyPercent(
                                item.getReviewCorrectCount(),
                                item.getReviewWrongCount()
                        );

        VocabularyQuiz quiz =
                vocabularyQuiz(
                        item,
                        pool
                );

        return ReviewItemResponse.from(
                item,
                quiz.questionType(),
                quiz.options(),
                mastery,
                accuracy
        );
    }

    private ReviewItemResponse toReviewItem(
            UserGrammar item,
            List<UserGrammar> pool
    ) {
        ReviewMasteryLevel mastery =
                masteryService.level(
                        item.getReviewCorrectCount(),
                        item.getReviewWrongCount(),
                        item.getCorrectStreak()
                );

        int accuracy =
                masteryService
                        .accuracyPercent(
                                item.getReviewCorrectCount(),
                                item.getReviewWrongCount()
                        );

        GrammarQuiz quiz =
                grammarQuiz(
                        item,
                        pool
                );

        return ReviewItemResponse.from(
                item,
                quiz.questionType(),
                quiz.options(),
                mastery,
                accuracy
        );
    }

    private record VocabularyQuiz(
            ReviewQuestionType questionType,
            List<ReviewOptionResponse> options
    ) {
    }

    private VocabularyQuiz vocabularyQuiz(
            UserVocabulary current,
            List<UserVocabulary> pool
    ) {
        List<ReviewQuestionType> questionTypes =
                new ArrayList<>();

        /*
         * Hai mode nền tảng có cho cả JA và EN.
         */
        questionTypes.add(
                ReviewQuestionType.WORD_TO_MEANING
        );

        questionTypes.add(
                ReviewQuestionType.MEANING_TO_WORD
        );

        /*
         * Japanese:
         * reading -> word/kanji
         */
        if (
                current.getLanguage()
                ==
                StudyLanguage.JA
                &&
                !safe(
                        current.getReading()
                ).isBlank()
        ) {
            questionTypes.add(
                    ReviewQuestionType.READING_TO_WORD
            );
        }

        /*
         * English:
         * IPA -> word
         */
        if (
                current.getLanguage()
                ==
                StudyLanguage.EN
                &&
                !safe(
                        current.getIpa()
                ).isBlank()
        ) {
            questionTypes.add(
                    ReviewQuestionType.IPA_TO_WORD
            );
        }

        /*
         * Mode chỉ random trong session response.
         * Không ảnh hưởng SRS.
         */
        Collections.shuffle(
                questionTypes
        );

        for (
                ReviewQuestionType questionType
                : questionTypes
        ) {
            if (
                    vocabularyPromptText(
                            current,
                            questionType
                    ).isBlank()
            ) {
                continue;
            }

            List<ReviewOptionResponse> options =
                    vocabularyOptions(
                            current,
                            pool,
                            questionType
                    );

            if (options.size() == 4) {
                return new VocabularyQuiz(
                        questionType,
                        options
                );
            }
        }

        /*
         * Không đủ 4 đáp án duy nhất.
         * Card giữ quizReady=false như behavior cũ.
         */
        return new VocabularyQuiz(
                ReviewQuestionType.WORD_TO_MEANING,
                List.of()
        );
    }

    private List<ReviewOptionResponse> vocabularyOptions(
            UserVocabulary current,
            List<UserVocabulary> pool,
            ReviewQuestionType questionType
    ) {
        ReviewQuestionType safeQuestionType =
                normalizeVocabularyQuestionType(
                        questionType,
                        current
                );

        String correctText =
                vocabularyOptionText(
                        current,
                        safeQuestionType
                );

        if (
                correctText.isBlank()
                ||
                vocabularyPromptText(
                        current,
                        safeQuestionType
                ).isBlank()
        ) {
            return List.of();
        }

        List<UserVocabulary> sameLevel =
                new ArrayList<>();

        List<UserVocabulary> others =
                new ArrayList<>();

        for (
                UserVocabulary candidate
                : pool
        ) {
            if (
                    candidate.getId()
                            .equals(
                                    current.getId()
                            )
                    ||
                    /*
                     * QUAN TRỌNG:
                     * tuyệt đối không trộn JA / EN.
                     */
                    candidate.getLanguage()
                            != current.getLanguage()
                    ||
                    vocabularyOptionText(
                            candidate,
                            safeQuestionType
                    ).isBlank()
            ) {
                continue;
            }

            if (
                    effectiveLevel(
                            candidate.getLanguage(),
                            candidate.getJlptLevel(),
                            candidate.getCefrLevel()
                    ).equalsIgnoreCase(
                            effectiveLevel(
                                    current.getLanguage(),
                                    current.getJlptLevel(),
                                    current.getCefrLevel()
                            )
                    )
            ) {
                sameLevel.add(
                        candidate
                );
            } else {
                others.add(
                        candidate
                );
            }
        }

        shuffle(
                sameLevel
        );

        shuffle(
                others
        );

        List<ReviewOptionResponse> options =
                new ArrayList<>();

        Set<String> answerTexts =
                new HashSet<>();

        addOption(
                options,
                answerTexts,
                ReviewItemType.VOCABULARY,
                current.getId(),
                correctText
        );

        appendVocabularyDistractors(
                options,
                answerTexts,
                sameLevel,
                safeQuestionType
        );

        appendVocabularyDistractors(
                options,
                answerTexts,
                others,
                safeQuestionType
        );

        if (options.size() != 4) {
            return List.of();
        }

        shuffle(
                options
        );

        return List.copyOf(
                options
        );
    }

    private void appendVocabularyDistractors(
            List<ReviewOptionResponse> options,
            Set<String> answerTexts,
            List<UserVocabulary> candidates,
            ReviewQuestionType questionType
    ) {
        for (
                UserVocabulary candidate
                : candidates
        ) {
            if (options.size() >= 4) {
                return;
            }

            addOption(
                    options,
                    answerTexts,
                    ReviewItemType.VOCABULARY,
                    candidate.getId(),
                    vocabularyOptionText(
                            candidate,
                            questionType
                    )
            );
        }
    }

    private ReviewQuestionType normalizeVocabularyQuestionType(
            ReviewQuestionType questionType,
            UserVocabulary item
    ) {
        ReviewQuestionType safeQuestionType =
                questionType == null
                        ? ReviewQuestionType.MEANING
                        : questionType;

        return switch (
                safeQuestionType
        ) {
            /*
             * MEANING là alias legacy của WORD_TO_MEANING.
             */
            case MEANING,
                 WORD_TO_MEANING,
                 MEANING_TO_WORD ->
                    safeQuestionType;

            case READING_TO_WORD -> {
                if (
                        item.getLanguage()
                        !=
                        StudyLanguage.JA
                        ||
                        safe(
                                item.getReading()
                        ).isBlank()
                ) {
                    throw new IllegalArgumentException(
                            "READING_TO_WORD chỉ dùng cho từ tiếng Nhật có reading."
                    );
                }

                yield safeQuestionType;
            }

            case IPA_TO_WORD -> {
                if (
                        item.getLanguage()
                        !=
                        StudyLanguage.EN
                        ||
                        safe(
                                item.getIpa()
                        ).isBlank()
                ) {
                    throw new IllegalArgumentException(
                            "IPA_TO_WORD chỉ dùng cho từ tiếng Anh có IPA."
                    );
                }

                yield safeQuestionType;
            }
            case PATTERN_TO_MEANING,
                 MEANING_TO_PATTERN,
                 EXAMPLE_TO_PATTERN ->
                    throw new IllegalArgumentException(
                            "Question type không phù hợp với Vocabulary."
                    );

        };
    }

    private String vocabularyPromptText(
            UserVocabulary item,
            ReviewQuestionType questionType
    ) {
        ReviewQuestionType safeQuestionType =
                normalizeVocabularyQuestionType(
                        questionType,
                        item
                );

        return switch (
                safeQuestionType
        ) {
            case MEANING,
                 WORD_TO_MEANING ->
                    vocabularyWord(
                            item
                    );

            case MEANING_TO_WORD ->
                    safe(
                            item.getMeaning()
                    );

            case READING_TO_WORD ->
                    safe(
                            item.getReading()
                    );

            case IPA_TO_WORD ->
                    safe(
                            item.getIpa()
                    );
            case PATTERN_TO_MEANING,
                 MEANING_TO_PATTERN,
                 EXAMPLE_TO_PATTERN ->
                    throw new IllegalArgumentException(
                            "Question type không phù hợp với Vocabulary."
                    );
        };
    }

    private String vocabularyOptionText(
            UserVocabulary item,
            ReviewQuestionType questionType
    ) {
        /*
         * Không validate READING/IPA trên distractor.
         *
         * Ví dụ IPA_TO_WORD:
         * prompt của current phải có IPA,
         * nhưng các đáp án nhiễu chỉ cần có WORD.
         */
        ReviewQuestionType safeQuestionType =
                questionType == null
                        ? ReviewQuestionType.MEANING
                        : questionType;

        return switch (
                safeQuestionType
        ) {
            case MEANING,
                 WORD_TO_MEANING ->
                    safe(
                            item.getMeaning()
                    );

            case MEANING_TO_WORD,
                 READING_TO_WORD,
                 IPA_TO_WORD ->
                    vocabularyWord(
                            item
                    );
            case PATTERN_TO_MEANING,
                 MEANING_TO_PATTERN,
                 EXAMPLE_TO_PATTERN ->
                    throw new IllegalArgumentException(
                            "Question type không phù hợp với Vocabulary."
                    );
        };
    }

    private String vocabularyWord(
            UserVocabulary item
    ) {
        if (
                item.getLanguage()
                ==
                StudyLanguage.EN
        ) {
            String lemma =
                    safe(
                            item.getLemma()
                    );

            if (!lemma.isBlank()) {
                return lemma;
            }
        }

        String dictionaryForm =
                safe(
                        item.getDictionaryForm()
                );

        if (!dictionaryForm.isBlank()) {
            return dictionaryForm;
        }

        return safe(
                item.getSurface()
        );
    }


    private record GrammarQuiz(
            ReviewQuestionType questionType,
            List<ReviewOptionResponse> options
    ) {
    }

    private GrammarQuiz grammarQuiz(
            UserGrammar current,
            List<UserGrammar> pool
    ) {
        List<ReviewQuestionType> questionTypes =
                new ArrayList<>();

        questionTypes.add(
                ReviewQuestionType.PATTERN_TO_MEANING
        );

        questionTypes.add(
                ReviewQuestionType.MEANING_TO_PATTERN
        );

        /*
         * EXAMPLE_TO_PATTERN chỉ khả dụng khi
         * grammar hiện tại thực sự có example.
         */
        if (
                !safe(
                        current.getExample()
                ).isBlank()
        ) {
            questionTypes.add(
                    ReviewQuestionType.EXAMPLE_TO_PATTERN
            );
        }

        /*
         * Random mode chỉ ảnh hưởng cách hỏi.
         * Không ảnh hưởng SRS.
         */
        Collections.shuffle(
                questionTypes
        );

        for (
                ReviewQuestionType questionType
                : questionTypes
        ) {
            if (
                    grammarPromptText(
                            current,
                            questionType
                    ).isBlank()
            ) {
                continue;
            }

            List<ReviewOptionResponse> options =
                    grammarOptions(
                            current,
                            pool,
                            questionType
                    );

            if (options.size() == 4) {
                return new GrammarQuiz(
                        questionType,
                        options
                );
            }
        }

        return new GrammarQuiz(
                ReviewQuestionType.PATTERN_TO_MEANING,
                List.of()
        );
    }

    private List<ReviewOptionResponse> grammarOptions(
            UserGrammar current,
            List<UserGrammar> pool,
            ReviewQuestionType questionType
    ) {
        ReviewQuestionType safeQuestionType =
                normalizeGrammarQuestionType(
                        questionType,
                        current
                );

        String correctText =
                grammarOptionText(
                        current,
                        safeQuestionType
                );

        String promptText =
                grammarPromptText(
                        current,
                        safeQuestionType
                );

        if (
                correctText.isBlank()
                ||
                promptText.isBlank()
        ) {
            return List.of();
        }

        List<UserGrammar> sameLevel =
                new ArrayList<>();

        List<UserGrammar> others =
                new ArrayList<>();

        for (
                UserGrammar candidate
                : pool
        ) {
            if (
                    candidate.getId()
                            .equals(
                                    current.getId()
                            )
                    ||
                    /*
                     * Tuyệt đối không trộn JA / EN.
                     */
                    candidate.getLanguage()
                            != current.getLanguage()
                    ||
                    grammarOptionText(
                            candidate,
                            safeQuestionType
                    ).isBlank()
            ) {
                continue;
            }

            if (
                    effectiveLevel(
                            candidate.getLanguage(),
                            candidate.getJlptLevel(),
                            candidate.getCefrLevel()
                    ).equalsIgnoreCase(
                            effectiveLevel(
                                    current.getLanguage(),
                                    current.getJlptLevel(),
                                    current.getCefrLevel()
                            )
                    )
            ) {
                sameLevel.add(
                        candidate
                );
            } else {
                others.add(
                        candidate
                );
            }
        }

        shuffle(
                sameLevel
        );

        shuffle(
                others
        );

        List<ReviewOptionResponse> options =
                new ArrayList<>();

        Set<String> answerTexts =
                new HashSet<>();

        addOption(
                options,
                answerTexts,
                ReviewItemType.GRAMMAR,
                current.getId(),
                correctText
        );

        appendGrammarDistractors(
                options,
                answerTexts,
                sameLevel,
                safeQuestionType
        );

        appendGrammarDistractors(
                options,
                answerTexts,
                others,
                safeQuestionType
        );

        if (options.size() != 4) {
            return List.of();
        }

        shuffle(
                options
        );

        return List.copyOf(
                options
        );
    }

    private void appendGrammarDistractors(
            List<ReviewOptionResponse> options,
            Set<String> answerTexts,
            List<UserGrammar> candidates,
            ReviewQuestionType questionType
    ) {
        for (
                UserGrammar candidate
                : candidates
        ) {
            if (options.size() >= 4) {
                return;
            }

            addOption(
                    options,
                    answerTexts,
                    ReviewItemType.GRAMMAR,
                    candidate.getId(),
                    grammarOptionText(
                            candidate,
                            questionType
                    )
            );
        }
    }

    private ReviewQuestionType normalizeGrammarQuestionType(
            ReviewQuestionType questionType,
            UserGrammar item
    ) {
        ReviewQuestionType safeQuestionType =
                questionType == null
                        ? ReviewQuestionType.MEANING
                        : questionType;

        return switch (
                safeQuestionType
        ) {
            /*
             * MEANING là legacy alias
             * của PATTERN_TO_MEANING.
             */
            case MEANING,
                 PATTERN_TO_MEANING,
                 MEANING_TO_PATTERN ->
                    safeQuestionType;

            case EXAMPLE_TO_PATTERN -> {
                if (
                        safe(
                                item.getExample()
                        ).isBlank()
                ) {
                    throw new IllegalArgumentException(
                            "EXAMPLE_TO_PATTERN cần grammar có example."
                    );
                }

                yield safeQuestionType;
            }

            case WORD_TO_MEANING,
                 MEANING_TO_WORD,
                 READING_TO_WORD,
                 IPA_TO_WORD ->
                    throw new IllegalArgumentException(
                            "Question type không phù hợp với Grammar."
                    );
        };
    }

    private String grammarPromptText(
            UserGrammar item,
            ReviewQuestionType questionType
    ) {
        ReviewQuestionType safeQuestionType =
                normalizeGrammarQuestionType(
                        questionType,
                        item
                );

        return switch (
                safeQuestionType
        ) {
            case MEANING,
                 PATTERN_TO_MEANING ->
                    safe(
                            item.getPattern()
                    );

            case MEANING_TO_PATTERN ->
                    safe(
                            item.getMeaning()
                    );

            case EXAMPLE_TO_PATTERN ->
                    safe(
                            item.getExample()
                    );

            case WORD_TO_MEANING,
                 MEANING_TO_WORD,
                 READING_TO_WORD,
                 IPA_TO_WORD ->
                    throw new IllegalArgumentException(
                            "Question type không phù hợp với Grammar."
                    );
        };
    }

    private String grammarOptionText(
            UserGrammar item,
            ReviewQuestionType questionType
    ) {
        /*
         * EXAMPLE_TO_PATTERN:
         * distractor KHÔNG cần có example.
         * Chỉ current prompt cần example.
         */
        ReviewQuestionType safeQuestionType =
                questionType == null
                        ? ReviewQuestionType.MEANING
                        : questionType;

        return switch (
                safeQuestionType
        ) {
            case MEANING,
                 PATTERN_TO_MEANING ->
                    safe(
                            item.getMeaning()
                    );

            case MEANING_TO_PATTERN,
                 EXAMPLE_TO_PATTERN ->
                    safe(
                            item.getPattern()
                    );

            case WORD_TO_MEANING,
                 MEANING_TO_WORD,
                 READING_TO_WORD,
                 IPA_TO_WORD ->
                    throw new IllegalArgumentException(
                            "Question type không phù hợp với Grammar."
                    );
        };
    }


    private void addOption(
            List<ReviewOptionResponse> options,
            Set<String> answerTexts,
            ReviewItemType itemType,
            Long itemId,
            String text
    ) {
        String clean =
                safe(text);

        if (clean.isBlank()) {
            return;
        }

        String key =
                clean
                        .toLowerCase(
                                Locale.ROOT
                        );

        if (!answerTexts.add(key)) {
            return;
        }

        options.add(
                new ReviewOptionResponse(
                        optionId(
                                itemType,
                                itemId
                        ),
                        clean
                )
        );
    }

    private String optionId(
            ReviewItemType itemType,
            Long itemId
    ) {
        return itemType.name()
                +
                ":"
                +
                itemId;
    }

    private long selectedItemId(
            String selectedOptionId,
            ReviewItemType expectedType
    ) {
        String clean =
                safe(
                        selectedOptionId
                );

        String prefix =
                expectedType.name()
                        +
                        ":";

        if (
                !clean.startsWith(
                        prefix
                )
        ) {
            throw new IllegalArgumentException(
                    "Đáp án không hợp lệ."
            );
        }

        try {
            long id =
                    Long.parseLong(
                            clean.substring(
                                    prefix.length()
                            )
                    );

            if (id <= 0) {
                throw new NumberFormatException();
            }

            return id;
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException(
                    "Đáp án không hợp lệ."
            );
        }
    }

    private void validateVocabularyOption(
            Long userId,
            long selectedId,
            StudyLanguage expectedLanguage
    ) {
        UserVocabulary selected =
                vocabularyRepository
                        .findByIdAndUserId(
                                selectedId,
                                userId
                        )
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "Đáp án từ vựng không tồn tại."
                                )
                        );

        if (
                selected.getLanguage()
                        != expectedLanguage
        ) {
            throw new IllegalArgumentException(
                    "Đáp án từ vựng không cùng ngôn ngữ."
            );
        }
    }

    private void validateGrammarOption(
            Long userId,
            long selectedId,
            StudyLanguage expectedLanguage
    ) {
        UserGrammar selected =
                grammarRepository
                        .findByIdAndUserId(
                                selectedId,
                                userId
                        )
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "Đáp án ngữ pháp không tồn tại."
                                )
                        );

        if (
                selected.getLanguage()
                        != expectedLanguage
        ) {
            throw new IllegalArgumentException(
                    "Đáp án ngữ pháp không cùng ngôn ngữ."
            );
        }
    }

    private VocabularyStatus vocabularyStatus(
            ReviewGrade grade,
            int repetitions
    ) {
        if (
                grade == ReviewGrade.AGAIN
                ||
                grade == ReviewGrade.HARD
        ) {
            return VocabularyStatus.LEARNING;
        }

        return repetitions >= 3
                ? VocabularyStatus.KNOWN
                : VocabularyStatus.LEARNING;
    }

    private GrammarStatus grammarStatus(
            ReviewGrade grade,
            int repetitions
    ) {
        if (
                grade == ReviewGrade.AGAIN
                ||
                grade == ReviewGrade.HARD
        ) {
            return GrammarStatus.LEARNING;
        }

        return repetitions >= 3
                ? GrammarStatus.KNOWN
                : GrammarStatus.LEARNING;
    }

    private StudyLanguage normalizeLanguage(
            StudyLanguage language
    ) {
        return language == StudyLanguage.EN
                ? StudyLanguage.EN
                : StudyLanguage.JA;
    }

    private String effectiveLevel(
            StudyLanguage language,
            String jlptLevel,
            String cefrLevel
    ) {
        if (language == StudyLanguage.EN) {
            return safe(
                    cefrLevel
            );
        }

        return safe(
                jlptLevel
        );
    }

    private int practiceMasteryPriority(
            ReviewMasteryLevel level
    ) {
        return switch (level) {
            case WEAK -> 0;
            case LEARNING -> 1;
            case NEW -> 2;
            case FAMILIAR -> 3;
            case MASTERED -> 4;
        };
    }

    private <T> void shuffle(
            List<T> items
    ) {
        Collections.shuffle(
                items,
                ThreadLocalRandom.current()
        );
    }

    private String safe(
            String value
    ) {
        return value == null
                ? ""
                : value.trim();
    }
}
