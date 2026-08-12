package com.dangt.aitranslator.backend.profile;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TranslationProfileRepository
        extends JpaRepository<TranslationProfile, Long> {

    List<TranslationProfile>
    findAllByUserIdOrderByDefaultProfileDescNameAsc(
            Long userId
    );

    Optional<TranslationProfile>
    findByIdAndUserId(
            Long id,
            Long userId
    );

    Optional<TranslationProfile>
    findByUserIdAndDefaultProfileTrue(
            Long userId
    );

    Optional<TranslationProfile>
    findByUserIdAndNameIgnoreCase(
            Long userId,
            String name
    );
}
