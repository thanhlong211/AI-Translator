package com.dangt.aitranslator.backend.review;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "review_events")
public class ReviewEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(
            name = "user_id",
            nullable = false
    )
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "item_type",
            nullable = false,
            length = 20
    )
    private ReviewItemType itemType;

    @Column(
            name = "item_id",
            nullable = false
    )
    private Long itemId;

    @Enumerated(EnumType.STRING)
    @Column(
            nullable = false,
            length = 20
    )
    private ReviewGrade grade;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "question_type",
            length = 30
    )
    private ReviewQuestionType questionType;

    @Column(
            name = "is_correct"
    )
    private Boolean correct;

    @Column(
            name = "response_time_ms"
    )
    private Integer responseTimeMs;

    @Column(
            name = "previous_interval_days",
            nullable = false
    )
    private int previousIntervalDays;

    @Column(
            name = "next_interval_days",
            nullable = false
    )
    private int nextIntervalDays;

    @Column(
            name = "previous_ease_factor",
            nullable = false
    )
    private double previousEaseFactor;

    @Column(
            name = "next_ease_factor",
            nullable = false
    )
    private double nextEaseFactor;

    @Column(
            name = "reviewed_at",
            nullable = false
    )
    private Instant reviewedAt;

    protected ReviewEvent() {
    }

    public ReviewEvent(
            Long userId,
            ReviewItemType itemType,
            Long itemId,
            ReviewGrade grade,
            ReviewQuestionType questionType,
            boolean correct,
            Long responseTimeMs,
            int previousIntervalDays,
            int nextIntervalDays,
            double previousEaseFactor,
            double nextEaseFactor,
            Instant reviewedAt
    ) {
        this.userId = userId;
        this.itemType = itemType;
        this.itemId = itemId;
        this.grade = grade;
        this.questionType = questionType;
        this.correct = correct;
        this.responseTimeMs =
                responseTimeMs == null
                        ? null
                        : (int) Math.min(
                                Integer.MAX_VALUE,
                                Math.max(
                                        0,
                                        responseTimeMs
                                )
                        );
        this.previousIntervalDays =
                previousIntervalDays;
        this.nextIntervalDays =
                nextIntervalDays;
        this.previousEaseFactor =
                previousEaseFactor;
        this.nextEaseFactor =
                nextEaseFactor;
        this.reviewedAt =
                reviewedAt;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public ReviewItemType getItemType() { return itemType; }
    public Long getItemId() { return itemId; }
    public ReviewGrade getGrade() { return grade; }
    public ReviewQuestionType getQuestionType() { return questionType; }
    public Boolean getCorrect() { return correct; }
    public Integer getResponseTimeMs() { return responseTimeMs; }
    public int getPreviousIntervalDays() { return previousIntervalDays; }
    public int getNextIntervalDays() { return nextIntervalDays; }
    public double getPreviousEaseFactor() { return previousEaseFactor; }
    public double getNextEaseFactor() { return nextEaseFactor; }
    public Instant getReviewedAt() { return reviewedAt; }
}
