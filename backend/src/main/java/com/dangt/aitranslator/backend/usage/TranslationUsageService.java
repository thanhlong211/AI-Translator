package com.dangt.aitranslator.backend.usage;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TranslationUsageService {

    private final TranslationUsageRepository repository;

    public TranslationUsageService(
            TranslationUsageRepository repository
    ) {
        this.repository = repository;
    }

    @Transactional
    public void recordSuccessfulTranslation(
            Long userId,
            String model,
            String sourceText,
            String translatedText
    ) {
        /*
         * We intentionally store only usage metadata.
         * Manga/dialogue text is NOT stored in MySQL.
         */
        TranslationUsageEvent event =
                new TranslationUsageEvent(
                        userId,
                        model,
                        sourceText.length(),
                        translatedText.length(),
                        true
                );

        repository.save(event);
    }

    @Transactional(readOnly = true)
    public long countAll() {
        return repository.count();
    }
}
