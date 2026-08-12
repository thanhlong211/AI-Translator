package com.dangt.aitranslator.backend.study;

import com.dangt.aitranslator.backend.auth.CurrentUserService;
import com.dangt.aitranslator.backend.common.ApiError;
import com.dangt.aitranslator.backend.entitlement.EntitlementService;
import com.dangt.aitranslator.backend.user.UserAccount;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/study")
@Tag(
        name = "Study",
        description =
                "Japanese Study Engine: dịch, reading, romaji, cấu trúc, ngữ pháp và từ vựng."
)
@SecurityRequirement(name = "bearerAuth")
public class StudyController {

    private final StudyService studyService;
    private final CurrentUserService currentUserService;
    private final EntitlementService entitlementService;

    public StudyController(
            StudyService studyService,
            CurrentUserService currentUserService,
            EntitlementService entitlementService
    ) {
        this.studyService =
                studyService;

        this.currentUserService =
                currentUserService;

        this.entitlementService =
                entitlementService;
    }

    @Operation(
            summary =
                    "Phân tích một câu tiếng Nhật",
            description =
                    "Trả structured Study Analysis. autoSaveVocabulary và autoSaveGrammar "
                            + "có thể upsert dữ liệu học vào kho cá nhân; toàn bộ câu manga/context không được lưu."
    )
    @ApiResponses({
            @ApiResponse(
                    responseCode = "200",
                    description =
                            "Phân tích thành công",
                    content = @Content(
                            mediaType =
                                    MediaType.APPLICATION_JSON_VALUE,
                            schema = @Schema(
                                    implementation =
                                            StudyAnalyzeResponse.class
                            )
                    )
            ),
            @ApiResponse(
                    responseCode = "400",
                    description =
                            "Request không hợp lệ",
                    content = @Content(
                            mediaType =
                                    MediaType.APPLICATION_JSON_VALUE,
                            schema = @Schema(
                                    implementation =
                                            ApiError.class
                            )
                    )
            ),
            @ApiResponse(
                    responseCode = "401",
                    description =
                            "Chưa đăng nhập hoặc JWT không hợp lệ"
            ),
            @ApiResponse(
                    responseCode = "502",
                    description =
                            "AI không trả về Study JSON hợp lệ",
                    content = @Content(
                            mediaType =
                                    MediaType.APPLICATION_JSON_VALUE,
                            schema = @Schema(
                                    implementation =
                                            ApiError.class
                            )
                    )
            )
    })
    @PostMapping(
            value = "/analyze",
            consumes =
                    MediaType.APPLICATION_JSON_VALUE,
            produces =
                    MediaType.APPLICATION_JSON_VALUE
    )
    public StudyAnalyzeResponse analyze(
            @Valid
            @RequestBody
            StudyAnalyzeRequest request,

            @AuthenticationPrincipal
            Jwt jwt
    ) {
        UserAccount user =
                currentUserService
                        .requireActiveUser(jwt);

        entitlementService.requireFeature(
                user,
                "studyMode",
                "Study Mode",
                "PRO"
        );

        return studyService.analyze(
                user.getId(),
                request
        );
    }
}
