package com.dangt.aitranslator.backend.common;

import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.http.HttpStatus;

import java.time.Instant;

@Schema(
        name = "ApiError",
        description = "Phản hồi lỗi chuẩn của backend."
)
public record ApiError(

        @Schema(example = "false")
        boolean success,

        @Schema(example = "VALIDATION_ERROR")
        String code,

        @Schema(example = "400")
        int status,

        @Schema(example = "Dữ liệu không hợp lệ.")
        String error,

        @Schema(
                example = "651652a4-4acb-4e81-96dd-08bb1aba39ed"
        )
        String requestId,

        Instant timestamp
) {

    public static ApiError of(
            String code,
            HttpStatus status,
            String message
    ) {
        return new ApiError(
                false,
                code,
                status.value(),
                message,
                RequestCorrelation
                        .currentId(),
                Instant.now()
        );
    }
}
