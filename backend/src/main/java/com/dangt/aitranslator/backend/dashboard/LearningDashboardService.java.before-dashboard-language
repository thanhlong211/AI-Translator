package com.dangt.aitranslator.backend.dashboard;

import com.dangt.aitranslator.backend.grammar.UserGrammar;
import com.dangt.aitranslator.backend.grammar.UserGrammarRepository;
import com.dangt.aitranslator.backend.review.*;
import com.dangt.aitranslator.backend.vocabulary.UserVocabulary;
import com.dangt.aitranslator.backend.vocabulary.UserVocabularyRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class LearningDashboardService {

    private final ReviewEventRepository reviewEventRepository;
    private final UserVocabularyRepository vocabularyRepository;
    private final UserGrammarRepository grammarRepository;
    private final ReviewMasteryService masteryService;
    private final ZoneId learningZone;

    public LearningDashboardService(
            ReviewEventRepository reviewEventRepository,
            UserVocabularyRepository vocabularyRepository,
            UserGrammarRepository grammarRepository,
            ReviewMasteryService masteryService,

            @Value(
                    "${app.learning.time-zone:Asia/Ho_Chi_Minh}"
            )
            String learningTimeZone
    ) {
        this.reviewEventRepository =
                reviewEventRepository;

        this.vocabularyRepository =
                vocabularyRepository;

        this.grammarRepository =
                grammarRepository;

        this.masteryService =
                masteryService;

        this.learningZone =
                parseZone(
                        learningTimeZone
                );
    }

    @Transactional(readOnly = true)
    public LearningDashboardResponse dashboard(
            Long userId
    ) {
        LocalDate today =
                LocalDate.now(
                        learningZone
                );

        LocalDate firstDay =
                today.minusDays(13);

        Instant since =
                firstDay
                        .atStartOfDay(
                                learningZone
                        )
                        .toInstant();

        List<ReviewEvent> events =
                reviewEventRepository
                        .findByUserIdAndReviewedAtGreaterThanEqualOrderByReviewedAtAsc(
                                userId,
                                since
                        );

        /*
         * Chỉ event quiz khách quan mới có is_correct.
         * Self-grade event cũ trước V8 không làm sai dashboard accuracy.
         */
        List<ReviewEvent> objectiveEvents =
                events
                        .stream()
                        .filter(
                                event ->
                                        event.getCorrect()
                                                != null
                        )
                        .toList();

        List<LearningDailyActivity> dailyActivity =
                buildDailyActivity(
                        firstDay,
                        today,
                        objectiveEvents
                );

        List<UserVocabulary> vocabulary =
                vocabularyRepository
                        .findTop500ByUserIdOrderByLastSeenAtDesc(
                                userId
                        );

        List<UserGrammar> grammar =
                grammarRepository
                        .findTop500ByUserIdOrderByLastSeenAtDesc(
                                userId
                        );

        List<LearningWeakItem> weakItems =
                buildWeakItems(
                        vocabulary,
                        grammar
                );

        long weakItemCount =
                Stream.concat(
                                vocabulary
                                        .stream()
                                        .map(
                                                this::toWeakItem
                                        ),
                                grammar
                                        .stream()
                                        .map(
                                                this::toWeakItem
                                        )
                        )
                        .filter(
                                Objects::nonNull
                        )
                        .count();

        long reviewed =
                objectiveEvents.size();

        long correct =
                objectiveEvents
                        .stream()
                        .filter(
                                event ->
                                        Boolean.TRUE.equals(
                                                event.getCorrect()
                                        )
                        )
                        .count();

        long wrong =
                reviewed - correct;

        int accuracy =
                reviewed == 0
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

        int activeDays =
                (int) dailyActivity
                        .stream()
                        .filter(
                                day ->
                                        day.reviewed() > 0
                        )
                        .count();

        int streak =
                currentStreak(
                        today,
                        dailyActivity
                );

        long masteredItems =
                Stream.concat(
                                vocabulary
                                        .stream()
                                        .map(
                                                item ->
                                                        masteryService
                                                                .level(
                                                                        item.getReviewCorrectCount(),
                                                                        item.getReviewWrongCount(),
                                                                        item.getCorrectStreak()
                                                                )
                                        ),
                                grammar
                                        .stream()
                                        .map(
                                                item ->
                                                        masteryService
                                                                .level(
                                                                        item.getReviewCorrectCount(),
                                                                        item.getReviewWrongCount(),
                                                                        item.getCorrectStreak()
                                                                )
                                        )
                        )
                        .filter(
                                level ->
                                        level ==
                                        ReviewMasteryLevel.MASTERED
                        )
                        .count();

        List<LearningRecentReview> recentReviews =
                buildRecentReviews(
                        userId,
                        vocabulary,
                        grammar
                );

        return new LearningDashboardResponse(
                new LearningDashboardOverview(
                        reviewed,
                        correct,
                        wrong,
                        accuracy,
                        activeDays,
                        streak,
                        weakItemCount,
                        masteredItems
                ),
                dailyActivity,
                weakItems,
                recentReviews
        );
    }

    private List<LearningDailyActivity> buildDailyActivity(
            LocalDate firstDay,
            LocalDate today,
            List<ReviewEvent> events
    ) {
        Map<LocalDate, List<ReviewEvent>> byDate =
                events
                        .stream()
                        .collect(
                                Collectors.groupingBy(
                                        event ->
                                                event
                                                        .getReviewedAt()
                                                        .atZone(
                                                                learningZone
                                                        )
                                                        .toLocalDate()
                                )
                        );

        List<LearningDailyActivity> result =
                new ArrayList<>();

        LocalDate cursor =
                firstDay;

        while (
                !cursor.isAfter(
                        today
                )
        ) {
            List<ReviewEvent> dayEvents =
                    byDate.getOrDefault(
                            cursor,
                            List.of()
                    );

            long reviewed =
                    dayEvents.size();

            long correct =
                    dayEvents
                            .stream()
                            .filter(
                                    event ->
                                            Boolean.TRUE.equals(
                                                    event.getCorrect()
                                            )
                            )
                            .count();

            long wrong =
                    reviewed - correct;

            int accuracy =
                    reviewed == 0
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

            result.add(
                    new LearningDailyActivity(
                            cursor,
                            reviewed,
                            correct,
                            wrong,
                            accuracy
                    )
            );

            cursor =
                    cursor.plusDays(1);
        }

        return List.copyOf(
                result
        );
    }

    private List<LearningWeakItem> buildWeakItems(
            List<UserVocabulary> vocabulary,
            List<UserGrammar> grammar
    ) {
        return Stream.concat(
                        vocabulary
                                .stream()
                                .map(
                                        this::toWeakItem
                                ),
                        grammar
                                .stream()
                                .map(
                                        this::toWeakItem
                                )
                )
                .filter(
                        Objects::nonNull
                )
                .sorted(
                        Comparator
                                .comparingInt(
                                        LearningWeakItem::priorityScore
                                )
                                .reversed()
                                .thenComparingInt(
                                        LearningWeakItem::accuracyPercent
                                )
                                .thenComparing(
                                        LearningWeakItem::primaryText
                                )
                )
                .limit(10)
                .toList();
    }

    private LearningWeakItem toWeakItem(
            UserVocabulary item
    ) {
        int correct =
                item.getReviewCorrectCount();

        int wrong =
                item.getReviewWrongCount();

        if (wrong <= 0) {
            return null;
        }

        ReviewMasteryLevel mastery =
                masteryService.level(
                        correct,
                        wrong,
                        item.getCorrectStreak()
                );

        if (
                mastery ==
                ReviewMasteryLevel.MASTERED
        ) {
            return null;
        }

        int accuracy =
                masteryService
                        .accuracyPercent(
                                correct,
                                wrong
                        );

        return new LearningWeakItem(
                ReviewItemType.VOCABULARY,
                item.getId(),
                item.getDictionaryForm(),
                safe(
                        item.getMeaning()
                ),
                safe(
                        item.getJlptLevel()
                ),
                mastery,
                accuracy,
                correct,
                wrong,
                item.getCorrectStreak(),
                weakPriority(
                        correct,
                        wrong,
                        item.getCorrectStreak()
                )
        );
    }

    private LearningWeakItem toWeakItem(
            UserGrammar item
    ) {
        int correct =
                item.getReviewCorrectCount();

        int wrong =
                item.getReviewWrongCount();

        if (wrong <= 0) {
            return null;
        }

        ReviewMasteryLevel mastery =
                masteryService.level(
                        correct,
                        wrong,
                        item.getCorrectStreak()
                );

        if (
                mastery ==
                ReviewMasteryLevel.MASTERED
        ) {
            return null;
        }

        int accuracy =
                masteryService
                        .accuracyPercent(
                                correct,
                                wrong
                        );

        return new LearningWeakItem(
                ReviewItemType.GRAMMAR,
                item.getId(),
                item.getPattern(),
                safe(
                        item.getMeaning()
                ),
                safe(
                        item.getJlptLevel()
                ),
                mastery,
                accuracy,
                correct,
                wrong,
                item.getCorrectStreak(),
                weakPriority(
                        correct,
                        wrong,
                        item.getCorrectStreak()
                )
        );
    }

    private int weakPriority(
            int correct,
            int wrong,
            int correctStreak
    ) {
        /*
         * Sai nhiều tăng priority mạnh.
         * Đúng nhiều / streak dài kéo priority xuống.
         */
        return Math.max(
                1,
                wrong * 4
                +
                Math.max(
                        0,
                        wrong - correct
                )
                *
                2
                -
                Math.min(
                        5,
                        correctStreak
                )
        );
    }

    private int currentStreak(
            LocalDate today,
            List<LearningDailyActivity> activity
    ) {
        Map<LocalDate, Long> reviewedByDate =
                activity
                        .stream()
                        .collect(
                                Collectors.toMap(
                                        LearningDailyActivity::date,
                                        LearningDailyActivity::reviewed
                                )
                        );

        LocalDate cursor =
                today;

        /*
         * Nếu hôm nay chưa học nhưng hôm qua có,
         * streak vẫn còn sống trong ngày hôm nay.
         */
        if (
                reviewedByDate
                        .getOrDefault(
                                cursor,
                                0L
                        )
                ==
                0
        ) {
            cursor =
                    cursor.minusDays(1);
        }

        int streak = 0;

        while (
                reviewedByDate
                        .getOrDefault(
                                cursor,
                                0L
                        )
                >
                0
        ) {
            streak += 1;
            cursor =
                    cursor.minusDays(1);
        }

        return streak;
    }

    private List<LearningRecentReview> buildRecentReviews(
            Long userId,
            List<UserVocabulary> vocabulary,
            List<UserGrammar> grammar
    ) {
        Map<Long, UserVocabulary> vocabularyById =
                vocabulary
                        .stream()
                        .collect(
                                Collectors.toMap(
                                        UserVocabulary::getId,
                                        Function.identity(),
                                        (
                                                first,
                                                second
                                        ) ->
                                                first
                                )
                        );

        Map<Long, UserGrammar> grammarById =
                grammar
                        .stream()
                        .collect(
                                Collectors.toMap(
                                        UserGrammar::getId,
                                        Function.identity(),
                                        (
                                                first,
                                                second
                                        ) ->
                                                first
                                )
                        );

        return reviewEventRepository
                .findTop100ByUserIdOrderByReviewedAtDesc(
                        userId
                )
                .stream()
                .filter(
                        event ->
                                event.getCorrect()
                                        != null
                )
                .limit(20)
                .map(
                        event ->
                                new LearningRecentReview(
                                        event.getId(),
                                        event.getItemType(),
                                        event.getItemId(),
                                        resolvePrimaryText(
                                                event,
                                                vocabularyById,
                                                grammarById
                                        ),
                                        event.getCorrect(),
                                        event.getGrade(),
                                        event.getResponseTimeMs(),
                                        event.getReviewedAt()
                                )
                )
                .toList();
    }

    private String resolvePrimaryText(
            ReviewEvent event,
            Map<Long, UserVocabulary> vocabularyById,
            Map<Long, UserGrammar> grammarById
    ) {
        if (
                event.getItemType() ==
                ReviewItemType.VOCABULARY
        ) {
            UserVocabulary item =
                    vocabularyById.get(
                            event.getItemId()
                    );

            return item == null
                    ? "Từ đã xóa"
                    : item.getDictionaryForm();
        }

        UserGrammar item =
                grammarById.get(
                        event.getItemId()
                );

        return item == null
                ? "Ngữ pháp đã xóa"
                : item.getPattern();
    }

    private ZoneId parseZone(
            String value
    ) {
        try {
            return ZoneId.of(
                    value
            );
        } catch (Exception ex) {
            return ZoneId.of(
                    "Asia/Ho_Chi_Minh"
            );
        }
    }

    private String safe(
            String value
    ) {
        return value == null
                ? ""
                : value.trim();
    }
}
