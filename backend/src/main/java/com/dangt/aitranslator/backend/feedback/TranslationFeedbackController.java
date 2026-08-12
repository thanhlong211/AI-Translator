package com.dangt.aitranslator.backend.feedback;

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
@RequestMapping("/api/v1/translation-feedback")
@Tag(
        name = "Translation Feedback",
        description = "User chủ động gửi bản sửa cho một kết quả dịch AI. Không tự động thu thập khi user chỉ sửa textarea."
)
@SecurityRequirement(name = "bearerAuth")
public class TranslationFeedbackController {

    private final TranslationFeedbackService feedbackService;
    private final CurrentUserService currentUserService;

    public TranslationFeedbackController(
            TranslationFeedbackService feedbackService,
            CurrentUserService currentUserService
    ) {
        this.feedbackService = feedbackService;
        this.currentUserService = currentUserService;
    }

    @Operation(
            summary = "Lưu correction do user chủ động gửi"
    )
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TranslationFeedbackResponse save(
            @Valid @RequestBody TranslationFeedbackRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount user =
                currentUserService.requireActiveUser(jwt);

        return feedbackService.save(
                user.getId(),
                request
        );
    }
}
