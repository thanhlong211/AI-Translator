package com.dangt.aitranslator.backend.review;

import com.dangt.aitranslator.backend.study.StudyLanguage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

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

    long countByUserIdAndLanguageAndGradeAndReviewedAtGreaterThanEqual(
            Long userId,
            StudyLanguage language,
            ReviewGrade grade,
            Instant since
    );

    long countByUserIdAndLanguageAndCorrectTrueAndReviewedAtGreaterThanEqual(
            Long userId,
            StudyLanguage language,
            Instant since
    );

    long countByUserIdAndLanguageAndCorrectFalseAndReviewedAtGreaterThanEqual(
            Long userId,
            StudyLanguage language,
            Instant since
    );

    List<ReviewEvent>
    findByUserIdAndReviewedAtGreaterThanEqualOrderByReviewedAtAsc(
            Long userId,
            Instant since
    );

    List<ReviewEvent>
    findByUserIdAndLanguageAndReviewedAtGreaterThanEqualOrderByReviewedAtAsc(
            Long userId,
            StudyLanguage language,
            Instant since
    );

    List<ReviewEvent>
    findTop100ByUserIdOrderByReviewedAtDesc(
            Long userId
    );

    List<ReviewEvent>
    findTop100ByUserIdAndLanguageOrderByReviewedAtDesc(
            Long userId,
            StudyLanguage language
    );
}
