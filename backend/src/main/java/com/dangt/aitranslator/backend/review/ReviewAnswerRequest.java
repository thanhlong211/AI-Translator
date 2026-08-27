package com.dangt.aitranslator.backend.review;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ReviewAnswerRequest(

        @NotNull
        @Schema(example = "VOCABULARY")
        ReviewItemType itemType,

        @NotNull
        @Schema(example = "1")
        Long itemId,

        /*
         * Additive / backward compatible.
         * Client cũ có thể không gửi -> backend dùng MEANING.
         */
        @Schema(
                description =
                        "Kiểu câu hỏi quiz đang hiển thị.",
                example =
                        "WORD_TO_MEANING"
        )
        ReviewQuestionType questionType,

        @NotBlank
        @Size(max = 64)
        @Schema(
                description =
                        "ID của một trong bốn đáp án mà backend đã trả ở review queue.",
                example = "VOCABULARY:7"
        )
        String selectedOptionId,

        @Min(0)
        @Max(300000)
        @Schema(
                description =
                        "Thời gian người dùng chọn đáp án, tính bằng milliseconds.",
                example = "3400"
        )
        Long responseTimeMs,

        @Schema(
                description =
                        "true = chế độ ôn tự do/ôn lại; chỉ chấm đáp án, không thay lịch SRS/mastery.",
                example = "false"
        )
        boolean practice

) {
}
