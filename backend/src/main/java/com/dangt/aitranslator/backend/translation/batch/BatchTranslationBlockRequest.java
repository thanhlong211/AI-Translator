package com.dangt.aitranslator.backend.translation.batch;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(
        description =
                "Một text block OCR. id do client tạo để ghép kết quả về đúng bounding box."
)
public record BatchTranslationBlockRequest(

        @NotBlank
        @Size(max = 64)
        @Schema(example = "block-1")
        String id,

        @NotBlank
        @Size(max = 1200)
        @Schema(example = "こんにちは")
        String text

) {
}
