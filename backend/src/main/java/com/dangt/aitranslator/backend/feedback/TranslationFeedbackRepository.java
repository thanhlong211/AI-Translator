package com.dangt.aitranslator.backend.feedback;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TranslationFeedbackRepository
        extends JpaRepository<TranslationFeedback, Long> {
}
