package com.dangt.aitranslator.backend.vocabulary;

import com.dangt.aitranslator.backend.auth.CurrentUserService;
import com.dangt.aitranslator.backend.user.UserAccount;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/vocabulary")
@Tag(
        name = "Vocabulary",
        description =
                "Personal Vocabulary theo từng user: search, status, favorite, note và encounter count."
)
@SecurityRequirement(name = "bearerAuth")
public class VocabularyController {

    private final VocabularyService vocabularyService;
    private final CurrentUserService currentUserService;

    public VocabularyController(
            VocabularyService vocabularyService,
            CurrentUserService currentUserService
    ) {
        this.vocabularyService =
                vocabularyService;

        this.currentUserService =
                currentUserService;
    }

    @Operation(
            summary =
                    "Danh sách từ vựng của user"
    )
    @GetMapping
    public VocabularyPageResponse search(
            @RequestParam(required = false)
            String q,

            @RequestParam(required = false)
            VocabularyStatus status,

            @RequestParam(required = false)
            Boolean favorite,

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

        return vocabularyService.search(
                user.getId(),
                q,
                status,
                favorite,
                page,
                size
        );
    }

    @Operation(
            summary =
                    "Thống kê Personal Vocabulary"
    )
    @GetMapping("/stats")
    public VocabularyStatsResponse stats(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        UserAccount user =
                currentUserService
                        .requireActiveUser(jwt);

        return vocabularyService.stats(
                user.getId()
        );
    }

    @Operation(
            summary =
                    "Lưu một từ từ Study UI",
            description =
                    "Chống duplicate bằng user + dictionaryForm + reading."
    )
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public VocabularyResponse save(
            @Valid
            @RequestBody
            VocabularySaveRequest request,

            @AuthenticationPrincipal
            Jwt jwt
    ) {
        UserAccount user =
                currentUserService
                        .requireActiveUser(jwt);

        return vocabularyService.save(
                user.getId(),
                request
        );
    }

    @Operation(
            summary =
                    "Cập nhật trạng thái/favorite/ghi chú"
    )
    @PatchMapping("/{vocabularyId}")
    public VocabularyResponse update(
            @PathVariable
            Long vocabularyId,

            @Valid
            @RequestBody
            VocabularyUpdateRequest request,

            @AuthenticationPrincipal
            Jwt jwt
    ) {
        UserAccount user =
                currentUserService
                        .requireActiveUser(jwt);

        return vocabularyService.update(
                user.getId(),
                vocabularyId,
                request
        );
    }

    @Operation(
            summary =
                    "Xóa từ khỏi kho cá nhân"
    )
    @DeleteMapping("/{vocabularyId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @PathVariable
            Long vocabularyId,

            @AuthenticationPrincipal
            Jwt jwt
    ) {
        UserAccount user =
                currentUserService
                        .requireActiveUser(jwt);

        vocabularyService.delete(
                user.getId(),
                vocabularyId
        );
    }
}
