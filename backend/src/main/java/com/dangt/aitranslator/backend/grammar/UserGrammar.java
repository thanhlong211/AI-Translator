package com.dangt.aitranslator.backend.grammar;

import com.dangt.aitranslator.backend.study.EnglishStudyGrammarPoint;
import com.dangt.aitranslator.backend.study.StudyGrammarPoint;
import com.dangt.aitranslator.backend.study.StudyLanguage;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "user_grammar")
public class UserGrammar {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private StudyLanguage language;

    @Column(
            name = "cefr_level",
            length = 20
    )
    private String cefrLevel;

    @Column(
            name = "matched_text",
            length = 500
    )
    private String matchedText;

    @Column(length = 1000)
    private String example;

    @Column(nullable = false, length = 255)
    private String pattern;

    @Column(
            name = "jlpt_level",
            nullable = false,
            length = 20
    )
    private String jlptLevel;

    @Column(length = 500)
    private String meaning;

    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(
            columnDefinition = "TEXT"
    )
    private String explanation;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "learning_status",
            nullable = false,
            length = 20
    )
    private GrammarStatus status;

    @Column(nullable = false)
    private boolean favorite;

    @Column(
            name = "encounter_count",
            nullable = false
    )
    private int encounterCount;

    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(
            name = "personal_note",
            columnDefinition = "TEXT"
    )
    private String personalNote;

    @Column(name = "first_seen_at", nullable = false)
    private Instant firstSeenAt;

    @Column(name = "last_seen_at", nullable = false)
    private Instant lastSeenAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(
            name = "due_at",
            nullable = false
    )
    private Instant dueAt;

    @Column(
            name = "interval_days",
            nullable = false
    )
    private int intervalDays;

    @Column(
            name = "ease_factor",
            nullable = false
    )
    private double easeFactor;

    @Column(nullable = false)
    private int repetitions;

    @Column(
            name = "lapse_count",
            nullable = false
    )
    private int lapseCount;

    @Column(
            name = "last_reviewed_at"
    )
    private Instant lastReviewedAt;

    @Column(
            name = "review_correct_count",
            nullable = false
    )
    private int reviewCorrectCount;

    @Column(
            name = "review_wrong_count",
            nullable = false
    )
    private int reviewWrongCount;

    @Column(
            name = "correct_streak",
            nullable = false
    )
    private int correctStreak;

    protected UserGrammar() {
    }

    public UserGrammar(
            Long userId,
            StudyGrammarPoint point
    ) {
        Instant now = Instant.now();

        this.userId = userId;
        this.language = StudyLanguage.JA;
        this.cefrLevel = null;
        this.matchedText = nullIfBlank(point.matchedText());
        this.example = null;
        this.pattern = required(point.pattern());
        this.jlptLevel = normalizeJlpt(point.jlptLevel());
        this.meaning = nullIfBlank(point.meaning());
        this.explanation = nullIfBlank(point.explanation());
        this.status = GrammarStatus.NEW;
        this.favorite = false;
        this.encounterCount = 1;
        this.firstSeenAt = now;
        this.lastSeenAt = now;
        this.createdAt = now;
        this.updatedAt = now;

        this.dueAt = now;
        this.intervalDays = 0;
        this.easeFactor = 2.50;
        this.repetitions = 0;
        this.lapseCount = 0;
        this.lastReviewedAt = null;
        this.reviewCorrectCount = 0;
        this.reviewWrongCount = 0;
        this.correctStreak = 0;
    }

    public UserGrammar(
            Long userId,
            EnglishStudyGrammarPoint point
    ) {
        Instant now =
                Instant.now();

        this.userId =
                userId;

        this.language =
                StudyLanguage.EN;

        this.pattern =
                required(
                        point.pattern()
                );

        this.jlptLevel =
                "UNKNOWN";

        this.cefrLevel =
                normalizeCefr(
                        point.cefrLevel()
                );

        this.meaning =
                nullIfBlank(
                        point.meaning()
                );

        this.matchedText =
                nullIfBlank(
                        point.matchedText()
                );

        this.explanation =
                nullIfBlank(
                        point.explanation()
                );

        this.example =
                nullIfBlank(
                        point.example()
                );

        this.status =
                GrammarStatus.NEW;

        this.favorite =
                false;

        this.encounterCount =
                1;

        this.firstSeenAt =
                now;

        this.lastSeenAt =
                now;

        this.createdAt =
                now;

        this.updatedAt =
                now;

        this.dueAt =
                now;

        this.intervalDays =
                0;

        this.easeFactor =
                2.50;

        this.repetitions =
                0;

        this.lapseCount =
                0;

        this.lastReviewedAt =
                null;

        this.reviewCorrectCount =
                0;

        this.reviewWrongCount =
                0;

        this.correctStreak =
                0;
    }

    public void applyReviewSchedule(
            Instant dueAt,
            int intervalDays,
            double easeFactor,
            int repetitions,
            int lapseCount,
            GrammarStatus status,
            Instant reviewedAt
    ) {
        this.dueAt = dueAt;
        this.intervalDays =
                Math.max(
                        0,
                        intervalDays
                );
        this.easeFactor = easeFactor;
        this.repetitions =
                Math.max(
                        0,
                        repetitions
                );
        this.lapseCount =
                Math.max(
                        0,
                        lapseCount
                );
        this.status = status;
        this.lastReviewedAt =
                reviewedAt;
        this.updatedAt =
                reviewedAt;
    }

    public void recordQuizResult(
            boolean correct
    ) {
        if (correct) {
            reviewCorrectCount += 1;
            correctStreak += 1;
        } else {
            reviewWrongCount += 1;
            correctStreak = 0;
        }
    }

    public void recordEncounter(
            StudyGrammarPoint point
    ) {
        mergeStudyData(point);

        encounterCount += 1;
        lastSeenAt = Instant.now();
        updatedAt = lastSeenAt;
    }

    public void mergeStudyData(
            StudyGrammarPoint point
    ) {
        String nextMeaning =
                clean(point.meaning());

        if (!nextMeaning.isBlank()) {
            meaning = nextMeaning;
        }

        String nextExplanation =
                clean(point.explanation());

        if (!nextExplanation.isBlank()) {
            explanation = nextExplanation;
        }

        String nextJlpt =
                normalizeJlpt(
                        point.jlptLevel()
                );

        if (
                !"UNKNOWN".equals(nextJlpt)
                ||
                jlptLevel == null
                ||
                jlptLevel.isBlank()
        ) {
            jlptLevel = nextJlpt;
        }

        updatedAt = Instant.now();
    }

    public void recordEncounter(
            EnglishStudyGrammarPoint point
    ) {
        mergeStudyData(
                point
        );

        encounterCount += 1;

        lastSeenAt =
                Instant.now();

        updatedAt =
                lastSeenAt;
    }

    public void mergeStudyData(
            EnglishStudyGrammarPoint point
    ) {
        String nextMeaning =
                clean(
                        point.meaning()
                );

        if (!nextMeaning.isBlank()) {
            meaning =
                    nextMeaning;
        }

        String nextExplanation =
                clean(
                        point.explanation()
                );

        if (!nextExplanation.isBlank()) {
            explanation =
                    nextExplanation;
        }

        String nextMatchedText =
                clean(
                        point.matchedText()
                );

        if (!nextMatchedText.isBlank()) {
            matchedText =
                    nextMatchedText;
        }

        String nextExample =
                clean(
                        point.example()
                );

        if (!nextExample.isBlank()) {
            example =
                    nextExample;
        }

        String nextCefr =
                normalizeCefr(
                        point.cefrLevel()
                );

        if (
                !"UNKNOWN".equals(
                        nextCefr
                )
                ||
                cefrLevel == null
                ||
                cefrLevel.isBlank()
        ) {
            cefrLevel =
                    nextCefr;
        }

        updatedAt =
                Instant.now();
    }

    public void updateLearningState(
            GrammarStatus status,
            Boolean favorite,
            String personalNote
    ) {
        if (status != null) {
            this.status = status;
        }

        if (favorite != null) {
            this.favorite = favorite;
        }

        if (personalNote != null) {
            this.personalNote =
                    nullIfBlank(personalNote);
        }

        updatedAt = Instant.now();
    }

    private static String required(
            String value
    ) {
        String clean = clean(value);

        if (clean.isBlank()) {
            throw new IllegalArgumentException(
                    "Grammar pattern không được để trống."
            );
        }

        return clean;
    }

    private static String normalizeJlpt(
            String value
    ) {
        String normalized =
                clean(value).toUpperCase();

        return switch (normalized) {
            case "N5", "N4", "N3", "N2", "N1" ->
                    normalized;
            default ->
                    "UNKNOWN";
        };
    }

    private static String normalizeCefr(
            String value
    ) {
        String normalized =
                clean(value)
                        .toUpperCase();

        return switch (normalized) {
            case "A1", "A2", "B1", "B2", "C1", "C2" ->
                    normalized;
            default ->
                    "UNKNOWN";
        };
    }

    private static String clean(
            String value
    ) {
        return value == null
                ? ""
                : value.trim();
    }

    private static String nullIfBlank(
            String value
    ) {
        String clean = clean(value);

        return clean.isBlank()
                ? null
                : clean;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public StudyLanguage getLanguage() { return language; }
    public String getCefrLevel() { return cefrLevel; }
    public String getMatchedText() { return matchedText; }
    public String getExample() { return example; }
    public String getPattern() { return pattern; }
    public String getJlptLevel() { return jlptLevel; }
    public String getMeaning() { return meaning; }
    public String getExplanation() { return explanation; }
    public GrammarStatus getStatus() { return status; }
    public boolean isFavorite() { return favorite; }
    public int getEncounterCount() { return encounterCount; }
    public String getPersonalNote() { return personalNote; }
    public Instant getFirstSeenAt() { return firstSeenAt; }
    public Instant getLastSeenAt() { return lastSeenAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getDueAt() { return dueAt; }
    public int getIntervalDays() { return intervalDays; }
    public double getEaseFactor() { return easeFactor; }
    public int getRepetitions() { return repetitions; }
    public int getLapseCount() { return lapseCount; }
    public Instant getLastReviewedAt() { return lastReviewedAt; }
    public int getReviewCorrectCount() {
        return reviewCorrectCount;
    }

    public int getReviewWrongCount() {
        return reviewWrongCount;
    }

    public int getCorrectStreak() {
        return correctStreak;
    }

}
