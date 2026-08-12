package com.dangt.aitranslator.backend.review;

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
                        .findTop100ByUserIdAndDueAtLessThanEqualOrderByDueAtAsc(
                                userId,
                                now
                        );

        List<UserGrammar> dueGrammar =
                grammarRepository
                        .findTop100ByUserIdAndDueAtLessThanEqualOrderByDueAtAsc(
                                userId,
                                now
                        );

        /*
         * Distractors lấy từ kho cá nhân, không gọi AI.
         * Bounded 500 item mỗi loại để queue vẫn nhẹ.
         */
        List<UserVocabulary> vocabularyPool =
                vocabularyRepository
                        .findTop500ByUserIdOrderByLastSeenAtDesc(
                                userId
                        );

        List<UserGrammar> grammarPool =
                grammarRepository
                        .findTop500ByUserIdOrderByLastSeenAtDesc(
                                userId
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
                                                        item.itemType().name()
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
                        .countByUserIdAndDueAtLessThanEqual(
                                userId,
                                now
                        );

        long grammarDue =
                grammarRepository
                        .countByUserIdAndDueAtLessThanEqual(
                                userId,
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
                        .findTop500ByUserIdOrderByLastSeenAtDesc(
                                userId
                        );

        List<UserGrammar> grammarPool =
                grammarRepository
                        .findTop500ByUserIdOrderByLastSeenAtDesc(
                                userId
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
                candidates
                        .stream()
                        .filter(
                                item ->
                                        item.itemType() ==
                                        ReviewItemType.VOCABULARY
                        )
                        .count();

        long grammarCount =
                candidates.size() -
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
        Instant now =
                Instant.now();

        Instant since =
                now.minus(
                        24,
                        ChronoUnit.HOURS
                );

        long vocabularyDue =
                vocabularyRepository
                        .countByUserIdAndDueAtLessThanEqual(
                                userId,
                                now
                        );

        long grammarDue =
                grammarRepository
                        .countByUserIdAndDueAtLessThanEqual(
                                userId,
                                now
                        );

        long correct =
                reviewEventRepository
                        .countByUserIdAndCorrectTrueAndReviewedAtGreaterThanEqual(
                                userId,
                                since
                        );

        long wrong =
                reviewEventRepository
                        .countByUserIdAndCorrectFalseAndReviewedAtGreaterThanEqual(
                                userId,
                                since
                        );

        /*
         * reviewedLast24h ở V6.6.2 chỉ tính quiz khách quan.
         * Event self-grade cũ trước V8 không làm sai accuracy mới.
         */
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
                        .countByUserIdAndGradeAndReviewedAtGreaterThanEqual(
                                userId,
                                ReviewGrade.AGAIN,
                                since
                        ),
                reviewEventRepository
                        .countByUserIdAndGradeAndReviewedAtGreaterThanEqual(
                                userId,
                                ReviewGrade.HARD,
                                since
                        ),
                reviewEventRepository
                        .countByUserIdAndGradeAndReviewedAtGreaterThanEqual(
                                userId,
                                ReviewGrade.GOOD,
                                since
                        ),
                reviewEventRepository
                        .countByUserIdAndGradeAndReviewedAtGreaterThanEqual(
                                userId,
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

        long selectedId =
                selectedItemId(
                        request.selectedOptionId(),
                        ReviewItemType.VOCABULARY
                );

        validateVocabularyOption(
                userId,
                selectedId
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
                safe(
                        item.getMeaning()
                ),
                ReviewItemResponse.from(
                        item,
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

        long selectedId =
                selectedItemId(
                        request.selectedOptionId(),
                        ReviewItemType.GRAMMAR
                );

        validateGrammarOption(
                userId,
                selectedId
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
                safe(
                        item.getMeaning()
                ),
                ReviewItemResponse.from(
                        item,
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

        long selectedId =
                selectedItemId(
                        request.selectedOptionId(),
                        ReviewItemType.VOCABULARY
                );

        validateVocabularyOption(
                userId,
                selectedId
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
                        ReviewItemType.VOCABULARY,
                        item.getId(),
                        automaticGrade,
                        ReviewQuestionType.MEANING,
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
                safe(
                        saved.getMeaning()
                ),
                ReviewItemResponse.from(
                        saved,
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

        long selectedId =
                selectedItemId(
                        request.selectedOptionId(),
                        ReviewItemType.GRAMMAR
                );

        validateGrammarOption(
                userId,
                selectedId
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
                        ReviewItemType.GRAMMAR,
                        item.getId(),
                        automaticGrade,
                        ReviewQuestionType.MEANING,
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
                safe(
                        saved.getMeaning()
                ),
                ReviewItemResponse.from(
                        saved,
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

        return ReviewItemResponse.from(
                item,
                vocabularyOptions(
                        item,
                        pool
                ),
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

        return ReviewItemResponse.from(
                item,
                grammarOptions(
                        item,
                        pool
                ),
                mastery,
                accuracy
        );
    }

    private List<ReviewOptionResponse> vocabularyOptions(
            UserVocabulary current,
            List<UserVocabulary> pool
    ) {
        String correctText =
                safe(
                        current.getMeaning()
                );

        if (correctText.isBlank()) {
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
                    safe(
                            candidate.getMeaning()
                    ).isBlank()
            ) {
                continue;
            }

            if (
                    safe(
                            candidate.getJlptLevel()
                    ).equalsIgnoreCase(
                            safe(
                                    current.getJlptLevel()
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
                sameLevel
        );

        appendVocabularyDistractors(
                options,
                answerTexts,
                others
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
            List<UserVocabulary> candidates
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
                    candidate.getMeaning()
            );
        }
    }

    private List<ReviewOptionResponse> grammarOptions(
            UserGrammar current,
            List<UserGrammar> pool
    ) {
        String correctText =
                safe(
                        current.getMeaning()
                );

        if (correctText.isBlank()) {
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
                    safe(
                            candidate.getMeaning()
                    ).isBlank()
            ) {
                continue;
            }

            if (
                    safe(
                            candidate.getJlptLevel()
                    ).equalsIgnoreCase(
                            safe(
                                    current.getJlptLevel()
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
                sameLevel
        );

        appendGrammarDistractors(
                options,
                answerTexts,
                others
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
            List<UserGrammar> candidates
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
                    candidate.getMeaning()
            );
        }
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
            long selectedId
    ) {
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
    }

    private void validateGrammarOption(
            Long userId,
            long selectedId
    ) {
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
