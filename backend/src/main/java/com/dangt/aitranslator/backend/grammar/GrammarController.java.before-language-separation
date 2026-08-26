package com.dangt.aitranslator.backend.grammar;

import com.dangt.aitranslator.backend.auth.CurrentUserService;
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
@RequestMapping("/api/v1/grammar")
@Tag(
        name = "Grammar",
        description =
                "Kho cấu trúc/ngữ pháp cá nhân theo từng user."
)
@SecurityRequirement(name = "bearerAuth")
public class GrammarController {

    private final GrammarService grammarService;
    private final CurrentUserService currentUserService;

    public GrammarController(
            GrammarService grammarService,
            CurrentUserService currentUserService
    ) {
        this.grammarService =
                grammarService;

        this.currentUserService =
                currentUserService;
    }

    @Operation(
            summary =
                    "Danh sách cấu trúc/ngữ pháp của user"
    )
    @GetMapping
    public GrammarPageResponse search(
            @RequestParam(required = false)
            String q,

            @RequestParam(required = false)
            GrammarStatus status,

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

        return grammarService.search(
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
                    "Thống kê Grammar Library"
    )
    @GetMapping("/stats")
    public GrammarStatsResponse stats(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        UserAccount user =
                currentUserService
                        .requireActiveUser(jwt);

        return grammarService.stats(
                user.getId()
        );
    }

    @Operation(
            summary =
                    "Lưu thủ công một cấu trúc/ngữ pháp"
    )
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public GrammarResponse save(
            @Valid
            @RequestBody
            GrammarSaveRequest request,

            @AuthenticationPrincipal
            Jwt jwt
    ) {
        UserAccount user =
                currentUserService
                        .requireActiveUser(jwt);

        return grammarService.save(
                user.getId(),
                request
        );
    }

    @Operation(
            summary =
                    "Cập nhật tiến độ/favorite/note"
    )
    @PatchMapping("/{grammarId}")
    public GrammarResponse update(
            @PathVariable
            Long grammarId,

            @Valid
            @RequestBody
            GrammarUpdateRequest request,

            @AuthenticationPrincipal
            Jwt jwt
    ) {
        UserAccount user =
                currentUserService
                        .requireActiveUser(jwt);

        return grammarService.update(
                user.getId(),
                grammarId,
                request
        );
    }

    @Operation(
            summary =
                    "Xóa cấu trúc/ngữ pháp"
    )
    @DeleteMapping("/{grammarId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @PathVariable
            Long grammarId,

            @AuthenticationPrincipal
            Jwt jwt
    ) {
        UserAccount user =
                currentUserService
                        .requireActiveUser(jwt);

        grammarService.delete(
                user.getId(),
                grammarId
        );
    }
}
