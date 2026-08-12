package com.dangt.aitranslator.backend.memory;

import com.dangt.aitranslator.backend.auth.CurrentUserService;
import com.dangt.aitranslator.backend.translation.TranslationLanguage;
import com.dangt.aitranslator.backend.user.UserAccount;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/translation-memory")
@Tag(
        name = "Translation Memory",
        description =
                "Personal exact-match Translation Memory: xem, tìm, sửa và xóa correction của user."
)
@SecurityRequirement(name = "bearerAuth")
public class TranslationMemoryController {

    private final TranslationMemoryService memoryService;
    private final CurrentUserService currentUserService;

    public TranslationMemoryController(
            TranslationMemoryService memoryService,
            CurrentUserService currentUserService
    ) {
        this.memoryService = memoryService;
        this.currentUserService = currentUserService;
    }

    @Operation(summary = "Danh sách Translation Memory của user")
    @GetMapping
    public TranslationMemoryPageResponse search(
            @RequestParam(required = false)
            String q,

            @RequestParam(required = false)
            Long profileId,

            @RequestParam(required = false)
            TranslationLanguage sourceLanguage,

            @RequestParam(required = false)
            TranslationLanguage targetLanguage,

            @RequestParam(defaultValue = "0")
            int page,

            @RequestParam(defaultValue = "50")
            int size,

            @AuthenticationPrincipal
            Jwt jwt
    ) {
        UserAccount user =
                currentUserService
                        .requireActiveUser(jwt);

        return memoryService.search(
                user.getId(),
                q,
                profileId,
                sourceLanguage,
                targetLanguage,
                page,
                size
        );
    }

    @Operation(summary = "Thống kê Personal Translation Memory")
    @GetMapping("/stats")
    public TranslationMemoryStatsResponse stats(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        UserAccount user =
                currentUserService
                        .requireActiveUser(jwt);

        return memoryService.stats(
                user.getId()
        );
    }

    @Operation(summary = "Sửa bản dịch đã ghi nhớ")
    @PatchMapping("/{memoryId}")
    public TranslationMemoryResponse update(
            @PathVariable
            Long memoryId,

            @Valid
            @RequestBody
            TranslationMemoryUpdateRequest request,

            @AuthenticationPrincipal
            Jwt jwt
    ) {
        UserAccount user =
                currentUserService
                        .requireActiveUser(jwt);

        return memoryService.update(
                user.getId(),
                memoryId,
                request
        );
    }

    @Operation(summary = "Xóa một Translation Memory")
    @DeleteMapping("/{memoryId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @PathVariable
            Long memoryId,

            @AuthenticationPrincipal
            Jwt jwt
    ) {
        UserAccount user =
                currentUserService
                        .requireActiveUser(jwt);

        memoryService.delete(
                user.getId(),
                memoryId
        );
    }
}
