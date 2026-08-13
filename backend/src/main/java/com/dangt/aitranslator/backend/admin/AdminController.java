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
    private final AdminPricingService pricingService;
    private final AdminSubscriptionService subscriptionService;
    private final AdminLicenseService licenseService;
    private final AdminTransactionService transactionService;
    private final AdminAuditService auditService;

    public AdminController(
            AdminGuard adminGuard,
            AdminService adminService,
            AdminPricingService pricingService,
            AdminSubscriptionService subscriptionService,
            AdminLicenseService licenseService,
            AdminTransactionService transactionService,
            AdminAuditService auditService
    ) {
        this.adminGuard = adminGuard;
        this.adminService = adminService;
        this.pricingService = pricingService;
        this.subscriptionService = subscriptionService;
        this.licenseService = licenseService;
        this.transactionService = transactionService;
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

    @GetMapping("/prices")
    public List<AdminPriceResponse> prices(
            @RequestParam(defaultValue = "") String planCode,
            @AuthenticationPrincipal Jwt jwt
    ) {
        adminGuard.requireAdmin(jwt);
        return pricingService.listPrices(planCode);
    }

    @GetMapping("/prices/{priceId}")
    public AdminPriceResponse price(
            @PathVariable long priceId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        adminGuard.requireAdmin(jwt);
        return pricingService.price(priceId);
    }

    @PostMapping("/prices")
    public AdminPriceResponse createPrice(
            @Valid @RequestBody AdminPriceCreateRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount actor = adminGuard.requireAdmin(jwt);
        return pricingService.createPrice(actor, request);
    }

    @PutMapping("/prices/{priceId}")
    public AdminPriceResponse updatePrice(
            @PathVariable long priceId,
            @Valid @RequestBody AdminPriceUpdateRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount actor = adminGuard.requireAdmin(jwt);
        return pricingService.updatePrice(actor, priceId, request);
    }

    @GetMapping("/licenses")
    public List<AdminLicenseResponse> licenses(
            @RequestParam(defaultValue = "") String planCode,
            @RequestParam(defaultValue = "") String status,
            @AuthenticationPrincipal Jwt jwt
    ) {
        adminGuard.requireAdmin(jwt);
        return licenseService.list(planCode, status);
    }

    @GetMapping("/licenses/{licenseId}")
    public AdminLicenseResponse license(
            @PathVariable long licenseId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        adminGuard.requireAdmin(jwt);
        return licenseService.detail(licenseId);
    }

    @PostMapping("/licenses")
    public AdminLicenseResponse createLicense(
            @Valid @RequestBody AdminLicenseCreateRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount actor = adminGuard.requireAdmin(jwt);
        return licenseService.create(actor, request);
    }

    @PutMapping("/licenses/{licenseId}")
    public AdminLicenseResponse updateLicense(
            @PathVariable long licenseId,
            @Valid @RequestBody AdminLicenseUpdateRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount actor = adminGuard.requireAdmin(jwt);
        return licenseService.update(actor, licenseId, request);
    }

    @PostMapping("/licenses/{licenseId}/activations/{activationId}/revoke")
    public AdminLicenseResponse revokeLicenseActivation(
            @PathVariable long licenseId,
            @PathVariable long activationId,
            @Valid @RequestBody AdminReasonRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount actor = adminGuard.requireAdmin(jwt);
        return licenseService.revokeActivation(actor, licenseId, activationId, request);
    }

    @PostMapping("/licenses/{licenseId}/activations/reset")
    public AdminLicenseResponse resetLicenseActivations(
            @PathVariable long licenseId,
            @Valid @RequestBody AdminReasonRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount actor = adminGuard.requireAdmin(jwt);
        return licenseService.resetActivations(actor, licenseId, request);
    }

    @GetMapping("/transactions")
    public List<AdminTransactionResponse> transactions(
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "") String planCode,
            @RequestParam(defaultValue = "") String provider,
            @RequestParam(defaultValue = "200") int limit,
            @AuthenticationPrincipal Jwt jwt
    ) {
        adminGuard.requireAdmin(jwt);
        return transactionService.list(status, planCode, provider, limit);
    }

    @GetMapping("/transactions/{transactionId}")
    public AdminTransactionResponse transaction(
            @PathVariable long transactionId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        adminGuard.requireAdmin(jwt);
        return transactionService.detail(transactionId);
    }

    @PostMapping("/transactions/manual")
    public AdminTransactionResponse createManualTransaction(
            @Valid @RequestBody AdminTransactionCreateRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount actor = adminGuard.requireAdmin(jwt);
        return transactionService.createManual(actor, request);
    }

    @PostMapping("/transactions/{transactionId}/settle")
    public AdminTransactionResponse settleTransaction(
            @PathVariable long transactionId,
            @Valid @RequestBody AdminTransactionSettleRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount actor = adminGuard.requireAdmin(jwt);
        return transactionService.settle(actor, transactionId, request);
    }

    @PostMapping("/transactions/{transactionId}/fail")
    public AdminTransactionResponse failTransaction(
            @PathVariable long transactionId,
            @Valid @RequestBody AdminTransactionFailureRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount actor = adminGuard.requireAdmin(jwt);
        return transactionService.fail(actor, transactionId, request);
    }

    @PostMapping("/transactions/{transactionId}/cancel")
    public AdminTransactionResponse cancelTransaction(
            @PathVariable long transactionId,
            @Valid @RequestBody AdminReasonRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount actor = adminGuard.requireAdmin(jwt);
        return transactionService.cancel(actor, transactionId, request);
    }

    @PostMapping("/transactions/{transactionId}/refund")
    public AdminTransactionResponse refundTransaction(
            @PathVariable long transactionId,
            @Valid @RequestBody AdminReasonRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount actor = adminGuard.requireAdmin(jwt);
        return transactionService.refund(actor, transactionId, request);
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


    @GetMapping("/users/{userId}/subscriptions")
    public List<AdminSubscriptionResponse> subscriptions(
            @PathVariable long userId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        adminGuard.requireAdmin(jwt);
        return subscriptionService.listForUser(userId);
    }

    @PostMapping("/users/{userId}/subscriptions")
    public AdminSubscriptionResponse createSubscription(
            @PathVariable long userId,
            @Valid @RequestBody AdminSubscriptionCreateRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount actor = adminGuard.requireAdmin(jwt);
        return subscriptionService.create(actor, userId, request);
    }

    @PostMapping("/subscriptions/{subscriptionId}/extend")
    public AdminSubscriptionResponse extendSubscription(
            @PathVariable long subscriptionId,
            @Valid @RequestBody AdminSubscriptionExtendRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount actor = adminGuard.requireAdmin(jwt);
        return subscriptionService.extend(actor, subscriptionId, request);
    }

    @PostMapping("/subscriptions/{subscriptionId}/cancel")
    public AdminSubscriptionResponse cancelSubscription(
            @PathVariable long subscriptionId,
            @Valid @RequestBody AdminReasonRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount actor = adminGuard.requireAdmin(jwt);
        return subscriptionService.cancel(actor, subscriptionId, request);
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
