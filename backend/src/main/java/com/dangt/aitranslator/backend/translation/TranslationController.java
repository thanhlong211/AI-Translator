package com.dangt.aitranslator.backend.translation;

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
@RequestMapping("/api/v1")
@Tag(
        name = "Translation",
        description =
                "OCR text → Profile Prompt Engine → AI Provider → ngôn ngữ đích."
)
public class TranslationController {

    private final TranslationService translationService;
    private final CurrentUserService currentUserService;
    private final EntitlementService entitlementService;

    public TranslationController(
            TranslationService translationService,
            CurrentUserService currentUserService,
            EntitlementService entitlementService
    ) {
        this.translationService =
                translationService;

        this.currentUserService =
                currentUserService;
        this.entitlementService =
                entitlementService;
    }

    @Operation(
            summary =
                    "Dịch đa ngôn ngữ bằng Translation Profile",
            description =
                    "Nếu profileId null, backend tự dùng Default Profile. "
                            + "sourceLanguage mặc định AUTO, targetLanguage mặc định VI. "
                            + "Context được giới hạn theo contextLines của profile."
    )
    @SecurityRequirement(name = "bearerAuth")
    @ApiResponses({
            @ApiResponse(
                    responseCode = "200",
                    description = "Dịch thành công",
                    content = @Content(
                            mediaType =
                                    MediaType.APPLICATION_JSON_VALUE,
                            schema = @Schema(
                                    implementation =
                                            TranslateResponse.class
                            )
                    )
            ),
            @ApiResponse(
                    responseCode = "400",
                    description =
                            "Request/profile không hợp lệ",
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
                            "Chưa đăng nhập hoặc token không hợp lệ"
            ),
            @ApiResponse(
                    responseCode = "502",
                    description =
                            "Backend/AI provider xử lý thất bại"
            )
    })
    @PostMapping(
            value = "/translate",
            consumes =
                    MediaType.APPLICATION_JSON_VALUE,
            produces =
                    MediaType.APPLICATION_JSON_VALUE
    )
    public TranslateResponse translate(
            @Valid
            @RequestBody
            TranslateRequest request,

            @AuthenticationPrincipal
            Jwt jwt
    ) {
        UserAccount user =
                currentUserService
                        .requireActiveUser(jwt);

        entitlementService
                .requireTranslationQuota(user);

        return translationService.translate(
                user.getId(),
                request
        );
    }
}
