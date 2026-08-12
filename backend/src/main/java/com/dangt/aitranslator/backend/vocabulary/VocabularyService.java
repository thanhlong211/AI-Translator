package com.dangt.aitranslator.backend.vocabulary;

import com.dangt.aitranslator.backend.study.StudyVocabularyItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class VocabularyService {

    private final UserVocabularyRepository repository;

    public VocabularyService(
            UserVocabularyRepository repository
    ) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public VocabularyPageResponse search(
            Long userId,
            String query,
            VocabularyStatus status,
            Boolean favorite,
            int page,
            int size
    ) {
        int safePage =
                Math.max(
                        0,
                        page
                );

        int safeSize =
                Math.max(
                        1,
                        Math.min(
                                100,
                                size
                        )
                );

        Pageable pageable =
                PageRequest.of(
                        safePage,
                        safeSize
                );

        Page<UserVocabulary> result =
                repository.search(
                        userId,
                        normalizeQuery(query),
                        status,
                        favorite,
                        pageable
                );

        return VocabularyPageResponse.from(
                result
        );
    }

    @Transactional(readOnly = true)
    public VocabularyStatsResponse stats(
            Long userId
    ) {
        return new VocabularyStatsResponse(
                repository.countByUserId(
                        userId
                ),

                repository.countByUserIdAndStatus(
                        userId,
                        VocabularyStatus.NEW
                ),

                repository.countByUserIdAndStatus(
                        userId,
                        VocabularyStatus.LEARNING
                ),

                repository.countByUserIdAndStatus(
                        userId,
                        VocabularyStatus.KNOWN
                ),

                repository.countByUserIdAndFavoriteTrue(
                        userId
                )
        );
    }

    @Transactional
    public VocabularyResponse save(
            Long userId,
            VocabularySaveRequest request
    ) {
        StudyVocabularyItem item =
                request.toStudyItem();

        UserVocabulary vocabulary =
                upsertOne(
                        userId,
                        item,
                        request.recordEncounter()
                ).vocabulary();

        return VocabularyResponse.from(
                vocabulary
        );
    }

    @Transactional
    public VocabularyResponse update(
            Long userId,
            Long vocabularyId,
            VocabularyUpdateRequest request
    ) {
        UserVocabulary vocabulary =
                requireOwned(
                        userId,
                        vocabularyId
                );

        vocabulary.updateLearningState(
                request.status(),
                request.favorite(),
                request.personalNote()
        );

        return VocabularyResponse.from(
                repository.saveAndFlush(
                        vocabulary
                )
        );
    }

    @Transactional
    public void delete(
            Long userId,
            Long vocabularyId
    ) {
        UserVocabulary vocabulary =
                requireOwned(
                        userId,
                        vocabularyId
                );

        repository.delete(
                vocabulary
        );
    }

    /**
     * Study Auto-save:
     * - mỗi unique dictionaryForm+reading chỉ tính 1 encounter / câu,
     * - từ đã có -> encounter_count + 1,
     * - từ mới -> NEW, encounter_count = 1.
     */
    @Transactional
    public VocabularySyncSummary recordStudyVocabulary(
            Long userId,
            List<StudyVocabularyItem> items
    ) {
        if (
                items == null ||
                items.isEmpty()
        ) {
            return new VocabularySyncSummary(
                    true,
                    0,
                    0,
                    0
            );
        }

        int inserted = 0;
        int updated = 0;
        int skipped = 0;

        Set<String> seenKeys =
                new HashSet<>();

        for (
                StudyVocabularyItem item
                : items
        ) {
            if (!isSavable(item)) {
                skipped += 1;
                continue;
            }

            String key =
                    vocabularyKey(
                            item
                    );

            if (!seenKeys.add(key)) {
                skipped += 1;
                continue;
            }

            UpsertResult result =
                    upsertOne(
                            userId,
                            item,
                            true
                    );

            if (result.inserted()) {
                inserted += 1;
            } else {
                updated += 1;
            }
        }

        return new VocabularySyncSummary(
                true,
                inserted,
                updated,
                skipped
        );
    }

    private UpsertResult upsertOne(
            Long userId,
            StudyVocabularyItem item,
            boolean recordEncounter
    ) {
        String dictionaryForm =
                normalizeDictionaryForm(
                        item
                );

        String reading =
                clean(
                        item.reading()
                );

        UserVocabulary existing =
                repository
                        .findByUserIdAndDictionaryFormAndReading(
                                userId,
                                dictionaryForm,
                                reading
                        )
                        .orElse(null);

        if (existing == null) {
            UserVocabulary created =
                    new UserVocabulary(
                            userId,
                            normalizedItem(
                                    item,
                                    dictionaryForm,
                                    reading
                            )
                    );

            return new UpsertResult(
                    repository.saveAndFlush(
                            created
                    ),
                    true
            );
        }

        StudyVocabularyItem normalized =
                normalizedItem(
                        item,
                        dictionaryForm,
                        reading
                );

        if (recordEncounter) {
            existing.recordEncounter(
                    normalized
            );
        } else {
            existing.mergeStudyData(
                    normalized
            );
        }

        return new UpsertResult(
                repository.saveAndFlush(
                        existing
                ),
                false
        );
    }

    private UserVocabulary requireOwned(
            Long userId,
            Long vocabularyId
    ) {
        if (
                vocabularyId == null ||
                vocabularyId <= 0
        ) {
            throw new IllegalArgumentException(
                    "Vocabulary ID không hợp lệ."
            );
        }

        return repository
                .findByIdAndUserId(
                        vocabularyId,
                        userId
                )
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Không tìm thấy từ vựng."
                        )
                );
    }

    private boolean isSavable(
            StudyVocabularyItem item
    ) {
        if (item == null) {
            return false;
        }

        return !normalizeDictionaryForm(
                item
        ).isBlank();
    }

    private String vocabularyKey(
            StudyVocabularyItem item
    ) {
        return normalizeDictionaryForm(
                item
        ).toLowerCase()
                + "\u0000"
                + clean(
                        item.reading()
                ).toLowerCase();
    }

    private StudyVocabularyItem normalizedItem(
            StudyVocabularyItem item,
            String dictionaryForm,
            String reading
    ) {
        String surface =
                clean(
                        item.surface()
                );

        if (surface.isBlank()) {
            surface =
                    dictionaryForm;
        }

        return new StudyVocabularyItem(
                surface,
                dictionaryForm,
                reading,
                clean(item.romaji()),
                clean(item.meaning()),
                clean(item.partOfSpeech()),
                normalizeJlpt(
                        item.jlptLevel()
                ),
                clean(item.note())
        );
    }

    private String normalizeDictionaryForm(
            StudyVocabularyItem item
    ) {
        if (item == null) {
            return "";
        }

        String value =
                clean(
                        item.dictionaryForm()
                );

        if (value.isBlank()) {
            value =
                    clean(
                            item.surface()
                    );
        }

        return value;
    }

    private String normalizeJlpt(
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

    private String normalizeQuery(
            String query
    ) {
        String clean =
                clean(query);

        return clean.isBlank()
                ? null
                : clean;
    }

    private String clean(
            String value
    ) {
        return value == null
                ? ""
                : value.trim();
    }

    private record UpsertResult(
            UserVocabulary vocabulary,
            boolean inserted
    ) {
    }
}
