package com.dangt.aitranslator.backend.review;

import com.dangt.aitranslator.backend.auth.CurrentUserService;
import com.dangt.aitranslator.backend.user.UserAccount;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/review")
@Tag(
        name = "Review",
        description =
                "SRS trắc nghiệm 4 đáp án cho Vocabulary + Grammar; grade được suy ra tự động từ hành vi đúng/sai."
)
@SecurityRequirement(name = "bearerAuth")
public class ReviewController {

    private final ReviewService reviewService;
    private final CurrentUserService currentUserService;

    public ReviewController(
            ReviewService reviewService,
            CurrentUserService currentUserService
    ) {
        this.reviewService =
                reviewService;
        this.currentUserService =
                currentUserService;
    }

    @Operation(
            summary =
                    "Lấy các item đến hạn ôn"
    )
    @GetMapping("/due")
    public ReviewQueueResponse due(
            @RequestParam(defaultValue = "30")
            int limit,

            @AuthenticationPrincipal
            Jwt jwt
    ) {
        UserAccount user =
                currentUserService
                        .requireActiveUser(
                                jwt
                        );

        return reviewService.due(
                user.getId(),
                limit
        );
    }

    @Operation(
            summary =
                    "Lấy bộ câu ôn tự do, không phụ thuộc dueAt"
    )
    @GetMapping("/practice")
    public ReviewQueueResponse practice(
            @RequestParam(defaultValue = "30")
            int limit,

            @AuthenticationPrincipal
            Jwt jwt
    ) {
        UserAccount user =
                currentUserService
                        .requireActiveUser(
                                jwt
                        );

        return reviewService.practice(
                user.getId(),
                limit
        );
    }

    @Operation(
            summary =
                    "Thống kê ôn tập hiện tại"
    )
    @GetMapping("/stats")
    public ReviewStatsResponse stats(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        UserAccount user =
                currentUserService
                        .requireActiveUser(
                                jwt
                        );

        return reviewService.stats(
                user.getId()
        );
    }

    @Operation(
            summary =
                    "Chấm đáp án; practice=false cập nhật SRS, practice=true chỉ luyện tập"
    )
    @PostMapping("/answer")
    public ReviewAnswerResponse answer(
            @Valid
            @RequestBody
            ReviewAnswerRequest request,

            @AuthenticationPrincipal
            Jwt jwt
    ) {
        UserAccount user =
                currentUserService
                        .requireActiveUser(
                                jwt
                        );

        return reviewService.answer(
                user.getId(),
                request
        );
    }
}
