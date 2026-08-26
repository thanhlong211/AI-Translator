package com.dangt.aitranslator.backend.study;

import com.dangt.aitranslator.backend.translation.TranslationContextItem;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

@Schema(
        name = "StudyAnalyzeRequest",
        description =
                "Văn bản cần dịch và phân tích phục vụ Study Mode."
)
public record StudyAnalyzeRequest(

        @NotBlank
        @Size(max = 4000)
        @Schema(
                description =
                        "Văn bản nguồn cần học. Hỗ trợ Japanese và English.",
                example = "学校へ行かなければならない。"
        )
        String text,

        @Schema(
                description =
                        "Translation Profile. Nếu null, backend dùng Default Profile.",
                example = "1"
        )
        Long profileId,

        @Schema(
                description =
                        "Ngôn ngữ đang học: JA hoặc EN. Nếu không truyền sẽ mặc định JA để tương thích client cũ.",
                example = "JA"
        )
        StudyLanguage language,

        @Schema(
                description =
                        "Trình độ giải thích mong muốn.",
                example = "N4"
        )
        StudyLevel level,

        @Schema(
                description =
                        "Nếu true, vocabulary AI phân tích sẽ được upsert vào kho từ cá nhân và tăng encounter_count.",
                example = "true"
        )
        boolean autoSaveVocabulary,

        @Schema(
                description =
                        "Nếu true, grammar/cấu trúc AI phân tích sẽ được upsert vào kho ngữ pháp cá nhân và tăng encounter_count.",
                example = "true"
        )
        boolean autoSaveGrammar,

        @Valid
        @Size(max = 50)
        @Schema(
                description =
                        "Các câu trước để hiểu ngữ cảnh. Backend vẫn giới hạn theo contextLines của Profile."
        )
        List<TranslationContextItem> context

) {

    public StudyAnalyzeRequest {

        language =
                language == null
                        ? StudyLanguage.JA
                        : language;

        level =
                level == null
                        ? StudyLevel.AUTO
                        : level;

        context =
                context == null
                        ? List.of()
                        : List.copyOf(context);
    }

    /*
     * Backward compatibility:
     *
     * Code Java/test cũ đang gọi constructor không có language
     * vẫn tiếp tục hoạt động và mặc định là Japanese.
     */
    public StudyAnalyzeRequest(
            String text,
            Long profileId,
            StudyLevel level,
            boolean autoSaveVocabulary,
            boolean autoSaveGrammar,
            List<TranslationContextItem> context
    ) {
        this(
                text,
                profileId,
                StudyLanguage.JA,
                level,
                autoSaveVocabulary,
                autoSaveGrammar,
                context
        );
    }
}
