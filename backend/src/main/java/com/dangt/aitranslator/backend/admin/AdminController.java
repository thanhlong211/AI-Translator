package com.dangt.aitranslator.backend.admin;

import com.dangt.aitranslator.backend.user.UserAccount;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin")
public class AdminController {

    private final AdminGuard adminGuard;
    private final AdminService adminService;
    private final AdminAuditService auditService;

    public AdminController(
            AdminGuard adminGuard,
            AdminService adminService,
            AdminAuditService auditService
    ) {
        this.adminGuard = adminGuard;
        this.adminService = adminService;
        this.auditService = auditService;
    }

    @GetMapping("/dashboard")
    public AdminDashboardResponse dashboard(
            @AuthenticationPrincipal Jwt jwt
    ) {
        adminGuard.requireAdmin(jwt);
        return adminService.dashboard();
    }

    @GetMapping("/plans")
    public List<AdminPlanResponse> plans(
            @AuthenticationPrincipal Jwt jwt
    ) {
        adminGuard.requireAdmin(jwt);
        return adminService.listPlans();
    }

    @GetMapping("/plan-schema")
    public AdminPlanSchemaResponse planSchema(
            @AuthenticationPrincipal Jwt jwt
    ) {
        adminGuard.requireAdmin(jwt);
        return adminService.planSchema();
    }

    @GetMapping("/plans/{planCode}")
    public AdminPlanDetailResponse plan(
            @PathVariable String planCode,
            @AuthenticationPrincipal Jwt jwt
    ) {
        adminGuard.requireAdmin(jwt);
        return adminService.planDetail(planCode);
    }

    @PostMapping("/plans")
    public AdminPlanDetailResponse createPlan(
            @Valid @RequestBody AdminPlanCreateRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount actor = adminGuard.requireAdmin(jwt);
        return adminService.createPlan(actor, request);
    }

    @PutMapping("/plans/{planCode}")
    public AdminPlanDetailResponse updatePlan(
            @PathVariable String planCode,
            @Valid @RequestBody AdminPlanDefinitionUpdateRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount actor = adminGuard.requireAdmin(jwt);
        return adminService.updatePlan(actor, planCode, request);
    }

    @GetMapping("/users")
    public AdminUserPageResponse users(
            @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @AuthenticationPrincipal Jwt jwt
    ) {
        adminGuard.requireAdmin(jwt);
        return adminService.listUsers(query, status, page, size);
    }

    @GetMapping("/users/{userId}")
    public AdminUserDetailResponse user(
            @PathVariable long userId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        adminGuard.requireAdmin(jwt);
        return adminService.userDetail(userId);
    }

    @PatchMapping("/users/{userId}/status")
    public AdminActionResponse updateStatus(
            @PathVariable long userId,
            @Valid @RequestBody AdminStatusUpdateRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount actor = adminGuard.requireAdmin(jwt);
        return adminService.updateStatus(actor, userId, request);
    }

    @PostMapping("/users/{userId}/sessions/revoke-all")
    public AdminActionResponse revokeSessions(
            @PathVariable long userId,
            @Valid @RequestBody AdminReasonRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount actor = adminGuard.requireAdmin(jwt);
        return adminService.revokeSessions(actor, userId, request);
    }

    @PutMapping("/users/{userId}/plan-override")
    public AdminActionResponse setPlan(
            @PathVariable long userId,
            @Valid @RequestBody AdminPlanUpdateRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount actor = adminGuard.requireAdmin(jwt);
        return adminService.setPlanOverride(actor, userId, request);
    }

    @PostMapping("/users/{userId}/plan-override/clear")
    public AdminActionResponse clearPlan(
            @PathVariable long userId,
            @Valid @RequestBody AdminReasonRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount actor = adminGuard.requireAdmin(jwt);
        return adminService.clearPlanOverride(actor, userId, request);
    }

    @GetMapping("/audit")
    public List<AdminAuditResponse> audit(
            @RequestParam(defaultValue = "100") int limit,
            @AuthenticationPrincipal Jwt jwt
    ) {
        adminGuard.requireAdmin(jwt);
        return auditService.recent(limit);
    }
}
