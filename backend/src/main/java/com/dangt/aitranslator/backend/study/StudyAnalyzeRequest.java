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
                "Câu tiếng Nhật OCR cần dịch và phân tích phục vụ Study Mode."
)
public record StudyAnalyzeRequest(

        @NotBlank
        @Size(max = 4000)
        @Schema(
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
        level =
                level == null
                        ? StudyLevel.AUTO
                        : level;

        context =
                context == null
                        ? List.of()
                        : List.copyOf(context);
    }
}
