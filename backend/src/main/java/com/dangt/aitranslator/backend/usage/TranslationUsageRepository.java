package com.dangt.aitranslator.backend.usage;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TranslationUsageRepository
        extends JpaRepository<TranslationUsageEvent, Long> {
}
