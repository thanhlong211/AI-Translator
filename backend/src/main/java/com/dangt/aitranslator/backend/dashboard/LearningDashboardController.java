package com.dangt.aitranslator.backend.dashboard;

import com.dangt.aitranslator.backend.auth.CurrentUserService;
import com.dangt.aitranslator.backend.user.UserAccount;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/learning")
@Tag(
        name = "Learning Dashboard",
        description =
                "Tiến độ học từ review metadata; không lưu screenshot/câu manga."
)
@SecurityRequirement(name = "bearerAuth")
public class LearningDashboardController {

    private final LearningDashboardService dashboardService;
    private final CurrentUserService currentUserService;

    public LearningDashboardController(
            LearningDashboardService dashboardService,
            CurrentUserService currentUserService
    ) {
        this.dashboardService =
                dashboardService;

        this.currentUserService =
                currentUserService;
    }

    @Operation(
            summary =
                    "Dashboard học tập 14 ngày + item yếu + lịch sử review gần đây"
    )
    @GetMapping("/dashboard")
    public LearningDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        UserAccount user =
                currentUserService
                        .requireActiveUser(
                                jwt
                        );

        return dashboardService
                .dashboard(
                        user.getId()
                );
    }
}
