package com.dangt.aitranslator.backend.vocabulary;

import com.dangt.aitranslator.backend.study.StudyVocabularyItem;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "user_vocabulary")
public class UserVocabulary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 190)
    private String surface;

    @Column(
            name = "dictionary_form",
            nullable = false,
            length = 190
    )
    private String dictionaryForm;

    @Column(nullable = false, length = 190)
    private String reading;

    @Column(length = 255)
    private String romaji;

    @Column(length = 500)
    private String meaning;

    @Column(
            name = "part_of_speech",
            length = 120
    )
    private String partOfSpeech;

    @Column(
            name = "jlpt_level",
            nullable = false,
            length = 20
    )
    private String jlptLevel;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "learning_status",
            nullable = false,
            length = 20
    )
    private VocabularyStatus status;

    @Column(nullable = false)
    private boolean favorite;

    @Column(
            name = "encounter_count",
            nullable = false
    )
    private int encounterCount;

    /**
     * MySQL TEXT is reported by JDBC as LONGVARCHAR.
     *
     * Do NOT use @Lob here with Hibernate 7/MySQL:
     * Hibernate may resolve a String CLOB as TINYTEXT, causing
     * ddl-auto=validate to fail against the existing TEXT column.
     */
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(
            name = "personal_note",
            columnDefinition = "TEXT"
    )
    private String personalNote;

    @Column(
            name = "first_seen_at",
            nullable = false
    )
    private Instant firstSeenAt;

    @Column(
            name = "last_seen_at",
            nullable = false
    )
    private Instant lastSeenAt;

    @Column(
            name = "created_at",
            nullable = false
    )
    private Instant createdAt;

    @Column(
            name = "updated_at",
            nullable = false
    )
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

    @Column(
            nullable = false
    )
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

    protected UserVocabulary() {
    }

    public UserVocabulary(
            Long userId,
            StudyVocabularyItem item
    ) {
        Instant now =
                Instant.now();

        this.userId = userId;
        this.surface =
                cleanRequired(
                        item.surface(),
                        item.dictionaryForm()
                );
        this.dictionaryForm =
                cleanRequired(
                        item.dictionaryForm(),
                        item.surface()
                );
        this.reading =
                clean(item.reading());
        this.romaji =
                nullIfBlank(
                        item.romaji()
                );
        this.meaning =
                nullIfBlank(
                        item.meaning()
                );
        this.partOfSpeech =
                nullIfBlank(
                        item.partOfSpeech()
                );
        this.jlptLevel =
                normalizeJlpt(
                        item.jlptLevel()
                );
        this.status =
                VocabularyStatus.NEW;
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
        this.reviewCorrectCount = 0;
        this.reviewWrongCount = 0;
        this.correctStreak = 0;
    }

    public void applyReviewSchedule(
            Instant dueAt,
            int intervalDays,
            double easeFactor,
            int repetitions,
            int lapseCount,
            VocabularyStatus status,
            Instant reviewedAt
    ) {
        this.dueAt =
                dueAt;
        this.intervalDays =
                Math.max(
                        0,
                        intervalDays
                );
        this.easeFactor =
                easeFactor;
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
        this.status =
                status;
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
            StudyVocabularyItem item
    ) {
        applyStudyData(item);

        encounterCount += 1;
        lastSeenAt =
                Instant.now();
        updatedAt =
                lastSeenAt;
    }

    /**
     * Manual save/update từ UI:
     * không tăng encounterCount.
     */
    public void mergeStudyData(
            StudyVocabularyItem item
    ) {
        applyStudyData(item);
        updatedAt =
                Instant.now();
    }

    public void updateLearningState(
            VocabularyStatus status,
            Boolean favorite,
            String personalNote
    ) {
        if (status != null) {
            this.status =
                    status;
        }

        if (favorite != null) {
            this.favorite =
                    favorite;
        }

        if (personalNote != null) {
            this.personalNote =
                    nullIfBlank(
                            personalNote
                    );
        }

        this.updatedAt =
                Instant.now();
    }

    private void applyStudyData(
            StudyVocabularyItem item
    ) {
        String nextSurface =
                clean(
                        item.surface()
                );

        if (!nextSurface.isBlank()) {
            this.surface =
                    nextSurface;
        }

        String nextRomaji =
                clean(
                        item.romaji()
                );

        if (!nextRomaji.isBlank()) {
            this.romaji =
                    nextRomaji;
        }

        String nextMeaning =
                clean(
                        item.meaning()
                );

        if (!nextMeaning.isBlank()) {
            this.meaning =
                    nextMeaning;
        }

        String nextPartOfSpeech =
                clean(
                        item.partOfSpeech()
                );

        if (!nextPartOfSpeech.isBlank()) {
            this.partOfSpeech =
                    nextPartOfSpeech;
        }

        String nextJlpt =
                normalizeJlpt(
                        item.jlptLevel()
                );

        if (
                !"UNKNOWN".equals(
                        nextJlpt
                )
                ||
                this.jlptLevel == null
                ||
                this.jlptLevel.isBlank()
        ) {
            this.jlptLevel =
                    nextJlpt;
        }
    }

    private static String cleanRequired(
            String preferred,
            String fallback
    ) {
        String value =
                clean(preferred);

        if (value.isBlank()) {
            value =
                    clean(fallback);
        }

        if (value.isBlank()) {
            throw new IllegalArgumentException(
                    "Vocabulary thiếu dictionaryForm/surface."
            );
        }

        return value;
    }

    private static String normalizeJlpt(
            String value
    ) {
        String normalized =
                clean(value)
                        .toUpperCase();

        return switch (normalized) {
            case "N5", "N4", "N3", "N2", "N1" ->
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
        String clean =
                clean(value);

        return clean.isBlank()
                ? null
                : clean;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getSurface() {
        return surface;
    }

    public String getDictionaryForm() {
        return dictionaryForm;
    }

    public String getReading() {
        return reading;
    }

    public String getRomaji() {
        return romaji;
    }

    public String getMeaning() {
        return meaning;
    }

    public String getPartOfSpeech() {
        return partOfSpeech;
    }

    public String getJlptLevel() {
        return jlptLevel;
    }

    public VocabularyStatus getStatus() {
        return status;
    }

    public boolean isFavorite() {
        return favorite;
    }

    public int getEncounterCount() {
        return encounterCount;
    }

    public String getPersonalNote() {
        return personalNote;
    }

    public Instant getFirstSeenAt() {
        return firstSeenAt;
    }

    public Instant getLastSeenAt() {
        return lastSeenAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getDueAt() {
        return dueAt;
    }

    public int getIntervalDays() {
        return intervalDays;
    }

    public double getEaseFactor() {
        return easeFactor;
    }

    public int getRepetitions() {
        return repetitions;
    }

    public int getLapseCount() {
        return lapseCount;
    }

    public Instant getLastReviewedAt() {
        return lastReviewedAt;
    }
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
