package com.dangt.aitranslator.backend.review;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;

public interface ReviewEventRepository
        extends JpaRepository<ReviewEvent, Long> {

    long countByUserIdAndReviewedAtGreaterThanEqual(
            Long userId,
            Instant since
    );

    long countByUserIdAndGradeAndReviewedAtGreaterThanEqual(
            Long userId,
            ReviewGrade grade,
            Instant since
    );

    long countByUserIdAndCorrectTrueAndReviewedAtGreaterThanEqual(
            Long userId,
            Instant since
    );

    long countByUserIdAndCorrectFalseAndReviewedAtGreaterThanEqual(
            Long userId,
            Instant since
    );

    java.util.List<ReviewEvent>
    findByUserIdAndReviewedAtGreaterThanEqualOrderByReviewedAtAsc(
            Long userId,
            Instant since
    );

    java.util.List<ReviewEvent>
    findTop100ByUserIdOrderByReviewedAtDesc(
            Long userId
    );

}
