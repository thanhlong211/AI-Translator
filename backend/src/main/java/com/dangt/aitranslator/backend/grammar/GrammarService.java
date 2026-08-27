package com.dangt.aitranslator.backend.grammar;

import com.dangt.aitranslator.backend.study.EnglishStudyGrammarPoint;
import com.dangt.aitranslator.backend.study.StudyGrammarPoint;
import com.dangt.aitranslator.backend.study.StudyLanguage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class GrammarService {

    private final UserGrammarRepository repository;

    public GrammarService(
            UserGrammarRepository repository
    ) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public GrammarPageResponse search(
            Long userId,
            String query,
            GrammarStatus status,
            Boolean favorite,
            int page,
            int size
    ) {
        return search(
                userId,
                StudyLanguage.JA,
                query,
                status,
                favorite,
                page,
                size
        );
    }

    @Transactional(readOnly = true)
    public GrammarPageResponse search(
            Long userId,
            StudyLanguage language,
            String query,
            GrammarStatus status,
            Boolean favorite,
            int page,
            int size
    ) {
        StudyLanguage safeLanguage =
                normalizeLanguage(language);

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

        Page<UserGrammar> result =
                repository.search(
                        userId,
                        safeLanguage,
                        normalizeQuery(query),
                        status,
                        favorite,
                        pageable
                );

        return GrammarPageResponse.from(
                result
        );
    }

    @Transactional(readOnly = true)
    public GrammarStatsResponse stats(
            Long userId
    ) {
        return stats(
                userId,
                StudyLanguage.JA
        );
    }

    @Transactional(readOnly = true)
    public GrammarStatsResponse stats(
            Long userId,
            StudyLanguage language
    ) {
        StudyLanguage safeLanguage =
                normalizeLanguage(language);

        return new GrammarStatsResponse(
                repository
                        .countByUserIdAndLanguage(
                                userId,
                                safeLanguage
                        ),

                repository
                        .countByUserIdAndLanguageAndStatus(
                                userId,
                                safeLanguage,
                                GrammarStatus.NEW
                        ),

                repository
                        .countByUserIdAndLanguageAndStatus(
                                userId,
                                safeLanguage,
                                GrammarStatus.LEARNING
                        ),

                repository
                        .countByUserIdAndLanguageAndStatus(
                                userId,
                                safeLanguage,
                                GrammarStatus.KNOWN
                        ),

                repository
                        .countByUserIdAndLanguageAndFavoriteTrue(
                                userId,
                                safeLanguage
                        )
        );
    }

    @Transactional
    public GrammarResponse save(
            Long userId,
            GrammarSaveRequest request
    ) {
        UpsertResult result =
                request.normalizedLanguage()
                        == StudyLanguage.EN
                        ? upsertEnglishOne(
                                userId,
                                request.toEnglishStudyPoint(),
                                request.recordEncounter()
                        )
                        : upsertOne(
                                userId,
                                request.toStudyPoint(),
                                request.recordEncounter()
                        );

        return GrammarResponse.from(
                result.grammar()
        );
    }

    @Transactional
    public GrammarResponse update(
            Long userId,
            Long grammarId,
            GrammarUpdateRequest request
    ) {
        UserGrammar grammar =
                requireOwned(
                        userId,
                        grammarId
                );

        grammar.updateLearningState(
                request.status(),
                request.favorite(),
                request.personalNote()
        );

        return GrammarResponse.from(
                repository.saveAndFlush(
                        grammar
                )
        );
    }

    @Transactional
    public void delete(
            Long userId,
            Long grammarId
    ) {
        repository.delete(
                requireOwned(
                        userId,
                        grammarId
                )
        );
    }

    @Transactional
    public GrammarSyncSummary recordStudyGrammar(
            Long userId,
            List<StudyGrammarPoint> items
    ) {
        if (
                items == null ||
                items.isEmpty()
        ) {
            return new GrammarSyncSummary(
                    true,
                    0,
                    0,
                    0
            );
        }

        int inserted = 0;
        int updated = 0;
        int skipped = 0;

        Set<String> seenPatterns =
                new HashSet<>();

        for (
                StudyGrammarPoint item
                : items
        ) {
            if (
                    item == null ||
                    clean(item.pattern()).isBlank()
            ) {
                skipped += 1;
                continue;
            }

            String key =
                    clean(
                            item.pattern()
                    ).toLowerCase();

            if (!seenPatterns.add(key)) {
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

        return new GrammarSyncSummary(
                true,
                inserted,
                updated,
                skipped
        );
    }

    @Transactional
    public GrammarSyncSummary recordEnglishStudyGrammar(
            Long userId,
            List<EnglishStudyGrammarPoint> items
    ) {
        if (
                items == null ||
                items.isEmpty()
        ) {
            return new GrammarSyncSummary(
                    true,
                    0,
                    0,
                    0
            );
        }

        int inserted = 0;
        int updated = 0;
        int skipped = 0;

        Set<String> seenPatterns =
                new HashSet<>();

        for (
                EnglishStudyGrammarPoint item
                : items
        ) {
            if (
                    item == null ||
                    clean(item.pattern()).isBlank()
            ) {
                skipped += 1;
                continue;
            }

            String key =
                    clean(
                            item.pattern()
                    ).toLowerCase();

            if (!seenPatterns.add(key)) {
                skipped += 1;
                continue;
            }

            UpsertResult result =
                    upsertEnglishOne(
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

        return new GrammarSyncSummary(
                true,
                inserted,
                updated,
                skipped
        );
    }

    private UpsertResult upsertOne(
            Long userId,
            StudyGrammarPoint item,
            boolean recordEncounter
    ) {
        String pattern =
                clean(
                        item.pattern()
                );

        if (pattern.isBlank()) {
            throw new IllegalArgumentException(
                    "Grammar pattern không được để trống."
            );
        }

        UserGrammar existing =
                repository
                        .findByUserIdAndLanguageAndPattern(
                                userId,
                                StudyLanguage.JA,
                                pattern
                        )
                        .orElse(null);

        if (existing == null) {
            UserGrammar created =
                    new UserGrammar(
                            userId,
                            normalizedPoint(
                                    item
                            )
                    );

            return new UpsertResult(
                    repository.saveAndFlush(
                            created
                    ),
                    true
            );
        }

        StudyGrammarPoint normalized =
                normalizedPoint(
                        item
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

    private UpsertResult upsertEnglishOne(
            Long userId,
            EnglishStudyGrammarPoint item,
            boolean recordEncounter
    ) {
        if (item == null) {
            throw new IllegalArgumentException(
                    "English grammar item trống."
            );
        }

        String pattern =
                clean(
                        item.pattern()
                );

        if (pattern.isBlank()) {
            throw new IllegalArgumentException(
                    "Grammar pattern không được để trống."
            );
        }

        UserGrammar existing =
                repository
                        .findByUserIdAndLanguageAndPattern(
                                userId,
                                StudyLanguage.EN,
                                pattern
                        )
                        .orElse(null);

        EnglishStudyGrammarPoint normalized =
                new EnglishStudyGrammarPoint(
                        pattern,
                        normalizeCefr(
                                item.cefrLevel()
                        ),
                        clean(item.meaning()),
                        clean(item.matchedText()),
                        clean(item.explanation()),
                        clean(item.example())
                );

        if (existing == null) {
            UserGrammar created =
                    new UserGrammar(
                            userId,
                            normalized
                    );

            return new UpsertResult(
                    repository.saveAndFlush(
                            created
                    ),
                    true
            );
        }

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

    private UserGrammar requireOwned(
            Long userId,
            Long grammarId
    ) {
        if (
                grammarId == null ||
                grammarId <= 0
        ) {
            throw new IllegalArgumentException(
                    "Grammar ID không hợp lệ."
            );
        }

        return repository
                .findByIdAndUserId(
                        grammarId,
                        userId
                )
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Không tìm thấy cấu trúc/ngữ pháp."
                        )
                );
    }

    private StudyGrammarPoint normalizedPoint(
            StudyGrammarPoint item
    ) {
        return new StudyGrammarPoint(
                clean(item.pattern()),
                normalizeJlpt(
                        item.jlptLevel()
                ),
                clean(item.meaning()),
                clean(item.matchedText()),
                clean(item.explanation()),
                clean(item.example())
        );
    }

    private String normalizeJlpt(
            String value
    ) {
        String normalized =
                clean(value).toUpperCase();

        return switch (normalized) {
            case "N5", "N4", "N3", "N2", "N1" ->
                    normalized;
            default ->
                    "UNKNOWN";
        };
    }

    private String normalizeCefr(
            String value
    ) {
        String normalized =
                clean(value)
                        .toUpperCase();

        return switch (normalized) {
            case "A1", "A2", "B1", "B2", "C1", "C2" ->
                    normalized;
            default ->
                    "UNKNOWN";
        };
    }

    private StudyLanguage normalizeLanguage(
            StudyLanguage language
    ) {
        return language == StudyLanguage.EN
                ? StudyLanguage.EN
                : StudyLanguage.JA;
    }

    private String normalizeQuery(
            String value
    ) {
        String clean =
                clean(value);

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
            UserGrammar grammar,
            boolean inserted
    ) {
    }
}
