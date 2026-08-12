package com.dangt.aitranslator.backend.memory;

import com.dangt.aitranslator.backend.translation.TranslationLanguage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Optional;

@Service
public class TranslationMemoryService {

    private final TranslationMemoryRepository repository;

    public TranslationMemoryService(
            TranslationMemoryRepository repository
    ) {
        this.repository = repository;
    }


    @Transactional(readOnly = true)
    public TranslationMemoryPageResponse search(
            Long userId,
            String query,
            Long profileId,
            TranslationLanguage sourceLanguage,
            TranslationLanguage targetLanguage,
            int page,
            int size
    ) {
        if (targetLanguage == TranslationLanguage.AUTO) {
            throw new IllegalArgumentException(
                    "targetLanguage không được là AUTO."
            );
        }

        if (profileId != null && profileId <= 0) {
            throw new IllegalArgumentException(
                    "Profile ID không hợp lệ."
            );
        }

        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(100, size));

        Pageable pageable = PageRequest.of(
                safePage,
                safeSize
        );

        Page<TranslationMemory> result =
                repository.search(
                        userId,
                        normalizeQuery(query),
                        profileId,
                        sourceLanguage,
                        targetLanguage,
                        pageable
                );

        return TranslationMemoryPageResponse.from(
                result
        );
    }

    @Transactional(readOnly = true)
    public TranslationMemoryStatsResponse stats(
            Long userId
    ) {
        return new TranslationMemoryStatsResponse(
                repository.countByUserId(userId),
                repository.sumHitCountByUserId(userId),
                repository.countByUserIdAndHitCountGreaterThan(
                        userId,
                        0L
                )
        );
    }

    @Transactional
    public TranslationMemoryResponse update(
            Long userId,
            Long memoryId,
            TranslationMemoryUpdateRequest request
    ) {
        TranslationMemory memory = requireOwned(
                userId,
                memoryId
        );

        String corrected = normalizeCorrection(
                request.correctedTranslation()
        );

        if (corrected.isBlank()) {
            throw new IllegalArgumentException(
                    "Bản dịch ghi nhớ không được để trống."
            );
        }

        memory.updateCorrectedTranslation(
                corrected
        );

        return TranslationMemoryResponse.from(
                repository.saveAndFlush(memory)
        );
    }

    @Transactional
    public void delete(
            Long userId,
            Long memoryId
    ) {
        TranslationMemory memory = requireOwned(
                userId,
                memoryId
        );

        repository.delete(memory);
    }

    @Transactional
    public TranslationMemory remember(
            Long userId,
            Long profileId,
            String sourceText,
            String correctedTranslation,
            TranslationLanguage sourceLanguage,
            TranslationLanguage targetLanguage,
            Long feedbackId
    ) {
        String normalizedSource = normalizeSource(sourceText);
        String normalizedCorrection = normalizeCorrection(correctedTranslation);
        String hash = hash(normalizedSource);

        TranslationMemory memory =
                repository
                        .findByUserIdAndProfileIdAndSourceLanguageAndTargetLanguageAndSourceHash(
                                userId,
                                profileId,
                                sourceLanguage,
                                targetLanguage,
                                hash
                        )
                        .orElseGet(() ->
                                new TranslationMemory(
                                        userId,
                                        profileId,
                                        hash,
                                        normalizedSource,
                                        normalizedCorrection,
                                        sourceLanguage,
                                        targetLanguage,
                                        feedbackId
                                )
                        );

        /*
         * SHA-256 collision is practically negligible, but keeping sourceText
         * lets lookup verify equality before returning a personal correction.
         */
        memory.updateCorrection(
                normalizedSource,
                normalizedCorrection,
                feedbackId
        );

        return repository.save(memory);
    }

    @Transactional
    public Optional<TranslationMemoryMatch> findExact(
            Long userId,
            Long profileId,
            String sourceText,
            TranslationLanguage sourceLanguage,
            TranslationLanguage targetLanguage
    ) {
        String normalizedSource = normalizeSource(sourceText);
        String hash = hash(normalizedSource);

        Optional<TranslationMemory> exact =
                findCandidate(
                        userId,
                        profileId,
                        normalizedSource,
                        sourceLanguage,
                        targetLanguage,
                        hash
                );

        /*
         * Most users translate with source=AUTO. If they later explicitly
         * choose JA/KO/ZH, a correction created under AUTO may still safely
         * serve the exact same source text and target language.
         */
        if (
                exact.isEmpty() &&
                sourceLanguage != TranslationLanguage.AUTO
        ) {
            exact = findCandidate(
                    userId,
                    profileId,
                    normalizedSource,
                    TranslationLanguage.AUTO,
                    targetLanguage,
                    hash
            );
        }

        if (exact.isEmpty()) {
            return Optional.empty();
        }

        TranslationMemory memory = exact.get();
        memory.markUsed();

        return Optional.of(
                new TranslationMemoryMatch(
                        memory.getId(),
                        memory.getCorrectedTranslation(),
                        memory.getSourceLanguage()
                )
        );
    }

    private Optional<TranslationMemory> findCandidate(
            Long userId,
            Long profileId,
            String normalizedSource,
            TranslationLanguage sourceLanguage,
            TranslationLanguage targetLanguage,
            String hash
    ) {
        return repository
                .findByUserIdAndProfileIdAndSourceLanguageAndTargetLanguageAndSourceHash(
                        userId,
                        profileId,
                        sourceLanguage,
                        targetLanguage,
                        hash
                )
                .filter(memory ->
                        normalizeSource(
                                memory.getSourceText()
                        ).equals(normalizedSource)
                );
    }

    private TranslationMemory requireOwned(
            Long userId,
            Long memoryId
    ) {
        if (memoryId == null || memoryId <= 0) {
            throw new IllegalArgumentException(
                    "Translation Memory ID không hợp lệ."
            );
        }

        return repository
                .findByIdAndUserId(
                        memoryId,
                        userId
                )
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Không tìm thấy Translation Memory."
                        )
                );
    }

    private String normalizeQuery(
            String value
    ) {
        String clean = value == null
                ? ""
                : value.trim();

        return clean.isBlank()
                ? null
                : clean;
    }

    private String normalizeSource(String value) {
        return value == null
                ? ""
                : value
                        .replace("\r\n", "\n")
                        .replace('\r', '\n')
                        .trim();
    }

    private String normalizeCorrection(String value) {
        return value == null ? "" : value.trim();
    }

    private String hash(String value) {
        try {
            MessageDigest digest =
                    MessageDigest.getInstance(
                            "SHA-256"
                    );

            return HexFormat.of().formatHex(
                    digest.digest(
                            value.getBytes(
                                    StandardCharsets.UTF_8
                            )
                    )
            );
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(
                    "SHA-256 không khả dụng.",
                    exception
            );
        }
    }
}
