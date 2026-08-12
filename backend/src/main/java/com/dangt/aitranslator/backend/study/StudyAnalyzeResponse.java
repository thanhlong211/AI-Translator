package com.dangt.aitranslator.backend.study;

import com.dangt.aitranslator.backend.common.ApiPerformanceTiming;
import com.dangt.aitranslator.backend.grammar.GrammarSyncSummary;
import com.dangt.aitranslator.backend.profile.TranslationProfile;
import com.dangt.aitranslator.backend.vocabulary.VocabularySyncSummary;
import io.swagger.v3.oas.annotations.media.Schema;

public record StudyAnalyzeResponse(

        @Schema(example = "true")
        boolean success,

        StudyAnalysisPayload analysis,

        ResolvedProfile profile,

        StudyLevel studyLevel,

        VocabularySyncSummary vocabularySync,

        GrammarSyncSummary grammarSync,

        ApiPerformanceTiming performance

) {
    public static StudyAnalyzeResponse success(
            StudyAnalysisPayload analysis,
            TranslationProfile profile,
            StudyLevel studyLevel,
            VocabularySyncSummary vocabularySync,
            GrammarSyncSummary grammarSync,
            ApiPerformanceTiming performance
    ) {
        return new StudyAnalyzeResponse(
                true,
                analysis,
                new ResolvedProfile(
                        profile.getId(),
                        profile.getName(),
                        profile.getStyle().name(),
                        profile.getUpdatedAt().toString()
                ),
                studyLevel,
                vocabularySync,
                grammarSync,
                performance
        );
    }

    public record ResolvedProfile(
            Long id,
            String name,
            String style,
            String updatedAt
    ) {
    }
}
