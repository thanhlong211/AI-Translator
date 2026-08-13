package com.dangt.aitranslator.backend.admin;

import com.dangt.aitranslator.backend.billing.RevenueBackfillResult;
import com.dangt.aitranslator.backend.billing.RevenueNormalizationService;
import com.dangt.aitranslator.backend.common.ForbiddenException;
import com.dangt.aitranslator.backend.usage.AiCostBackfillResult;
import com.dangt.aitranslator.backend.usage.AiCostCalculationService;
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
    private final AdminAiUsageService aiUsageService;
    private final AdminAiCostDashboardService aiCostDashboardService;
    private final AdminAiCostDrilldownService aiCostDrilldownService;
    private final AdminAiModelCostService aiModelCostService;
    private final AiCostCalculationService aiCostCalculationService;
    private final AdminFxRateService fxRateService;
    private final RevenueNormalizationService revenueNormalizationService;
    private final AdminMarginDashboardService marginDashboardService;
    private final AdminSecurityEventService securityEventService;
    private final AdminAuditService auditService;

    public AdminController(
            AdminGuard adminGuard,
            AdminService adminService,
            AdminPricingService pricingService,
            AdminSubscriptionService subscriptionService,
            AdminLicenseService licenseService,
            AdminTransactionService transactionService,
            AdminAiUsageService aiUsageService,
            AdminAiCostDashboardService aiCostDashboardService,
            AdminAiCostDrilldownService aiCostDrilldownService,
            AdminAiModelCostService aiModelCostService,
            AiCostCalculationService aiCostCalculationService,
            AdminFxRateService fxRateService,
            RevenueNormalizationService revenueNormalizationService,
            AdminMarginDashboardService marginDashboardService,
            AdminSecurityEventService securityEventService,
            AdminAuditService auditService
    ) {
        this.adminGuard = adminGuard;
        this.adminService = adminService;
        this.pricingService = pricingService;
        this.subscriptionService = subscriptionService;
        this.licenseService = licenseService;
        this.transactionService = transactionService;
        this.aiUsageService = aiUsageService;
        this.aiCostDashboardService = aiCostDashboardService;
        this.aiCostDrilldownService = aiCostDrilldownService;
        this.aiModelCostService = aiModelCostService;
        this.aiCostCalculationService = aiCostCalculationService;
        this.fxRateService = fxRateService;
        this.revenueNormalizationService = revenueNormalizationService;
        this.marginDashboardService = marginDashboardService;
        this.securityEventService = securityEventService;
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


    @GetMapping("/margin-dashboard")
    public AdminMarginDashboardResponse marginDashboard(
            @RequestParam(defaultValue = "7") int days,
            @AuthenticationPrincipal Jwt jwt
    ) {
        adminGuard.requireAdmin(jwt);
        return marginDashboardService.dashboard(days);
    }

    @GetMapping("/fx-rates")
    public List<AdminFxRateResponse> fxRates(
            @RequestParam(defaultValue = "") String baseCurrency,
            @RequestParam(defaultValue = "") String quoteCurrency,
            @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "200") int limit,
            @AuthenticationPrincipal Jwt jwt
    ) {
        adminGuard.requireAdmin(jwt);
        return fxRateService.list(baseCurrency, quoteCurrency, active, limit);
    }

    @GetMapping("/fx-rates/{rateId}")
    public AdminFxRateResponse fxRate(
            @PathVariable long rateId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        adminGuard.requireAdmin(jwt);
        return fxRateService.detail(rateId);
    }

    @PostMapping("/fx-rates")
    public AdminFxRateResponse createFxRate(
            @Valid @RequestBody AdminFxRateCreateRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount actor = adminGuard.requireAdmin(jwt);
        return fxRateService.create(actor, request);
    }

    @PutMapping("/fx-rates/{rateId}")
    public AdminFxRateResponse updateFxRate(
            @PathVariable long rateId,
            @Valid @RequestBody AdminFxRateUpdateRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount actor = adminGuard.requireAdmin(jwt);
        return fxRateService.update(actor, rateId, request);
    }

    @PostMapping("/revenue/backfill")
    public AdminRevenueBackfillResponse backfillRevenue(
            @RequestParam(defaultValue = "500") int limit,
            @Valid @RequestBody AdminReasonRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount actor = adminGuard.requireAdmin(jwt);
        if (!adminGuard.isSuperAdmin(actor)) {
            throw new ForbiddenException("Chỉ SUPER_ADMIN được backfill revenue normalization.");
        }
        RevenueBackfillResult result = revenueNormalizationService.backfill(limit);
        auditService.record(
                actor.getId(),
                "REVENUE_BACKFILLED",
                null,
                "currency=" + result.reportingCurrency()
                        + "; scanned=" + result.scanned()
                        + "; normalized=" + result.normalized()
                        + "; missingFx=" + result.missingFx()
                        + "; unsupportedCurrency=" + result.unsupportedCurrency()
                        + "; reason=" + request.reason()
        );
        return new AdminRevenueBackfillResponse(
                result.reportingCurrency(),
                result.scanned(),
                result.normalized(),
                result.missingFx(),
                result.unsupportedCurrency()
        );
    }

    @GetMapping("/ai-cost-dashboard")
    public AdminAiCostDashboardResponse aiCostDashboard(
            @RequestParam(defaultValue = "7") int days,
            @AuthenticationPrincipal Jwt jwt
    ) {
        adminGuard.requireAdmin(jwt);
        return aiCostDashboardService.dashboard(days);
    }

    @GetMapping("/ai-cost-drilldown")
    public AdminAiCostDrilldownResponse aiCostDrilldown(
            @RequestParam(defaultValue = "7") int days,
            @RequestParam String dimension,
            @RequestParam String key,
            @AuthenticationPrincipal Jwt jwt
    ) {
        adminGuard.requireAdmin(jwt);
        return aiCostDrilldownService.drilldown(days, dimension, key);
    }

    @GetMapping("/ai-usage")
    public List<AdminAiUsageResponse> aiUsage(
            @RequestParam(required = false) Long userId,
            @RequestParam(defaultValue = "") String feature,
            @RequestParam(defaultValue = "") String provider,
            @RequestParam(defaultValue = "") String model,
            @RequestParam(required = false) Boolean successful,
            @RequestParam(defaultValue = "200") int limit,
            @AuthenticationPrincipal Jwt jwt
    ) {
        adminGuard.requireAdmin(jwt);
        return aiUsageService.list(
                userId,
                feature,
                provider,
                model,
                successful,
                limit
        );
    }

    @GetMapping("/ai-usage/{eventId}")
    public AdminAiUsageResponse aiUsageEvent(
            @PathVariable long eventId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        adminGuard.requireAdmin(jwt);
        return aiUsageService.detail(eventId);
    }

    @PostMapping("/ai-usage/costs/backfill")
    public AdminAiCostBackfillResponse backfillAiUsageCosts(
            @RequestParam(defaultValue = "500") int limit,
            @Valid @RequestBody AdminReasonRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount actor = adminGuard.requireAdmin(jwt);
        if (!adminGuard.isSuperAdmin(actor)) {
            throw new ForbiddenException("Chỉ SUPER_ADMIN được backfill AI cost.");
        }

        AiCostBackfillResult result = aiCostCalculationService.backfillMissingRates(limit);
        auditService.record(
                actor.getId(),
                "AI_USAGE_COST_BACKFILLED",
                null,
                "currency=" + aiCostCalculationService.reportingCurrency()
                        + "; scanned=" + result.scanned()
                        + "; calculated=" + result.calculated()
                        + "; missingRate=" + result.missingRate()
                        + "; tokenUsageUnavailable=" + result.tokenUsageUnavailable()
                        + "; reason=" + request.reason().trim()
        );

        return new AdminAiCostBackfillResponse(
                aiCostCalculationService.reportingCurrency(),
                result.scanned(),
                result.calculated(),
                result.missingRate(),
                result.tokenUsageUnavailable()
        );
    }

    @GetMapping("/ai-model-costs")
    public List<AdminAiModelCostResponse> aiModelCosts(
            @RequestParam(defaultValue = "") String provider,
            @RequestParam(defaultValue = "") String model,
            @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "200") int limit,
            @AuthenticationPrincipal Jwt jwt
    ) {
        adminGuard.requireAdmin(jwt);
        return aiModelCostService.list(provider, model, active, limit);
    }

    @GetMapping("/ai-model-costs/{costId}")
    public AdminAiModelCostResponse aiModelCost(
            @PathVariable long costId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        adminGuard.requireAdmin(jwt);
        return aiModelCostService.detail(costId);
    }

    @PostMapping("/ai-model-costs")
    public AdminAiModelCostResponse createAiModelCost(
            @Valid @RequestBody AdminAiModelCostCreateRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount actor = adminGuard.requireAdmin(jwt);
        return aiModelCostService.create(actor, request);
    }

    @PutMapping("/ai-model-costs/{costId}")
    public AdminAiModelCostResponse updateAiModelCost(
            @PathVariable long costId,
            @Valid @RequestBody AdminAiModelCostUpdateRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount actor = adminGuard.requireAdmin(jwt);
        return aiModelCostService.update(actor, costId, request);
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

    @GetMapping("/security-events")
    public AdminSecurityDashboardResponse securityEvents(
            @RequestParam(defaultValue = "7") int days,
            @RequestParam(defaultValue = "") String severity,
            @RequestParam(defaultValue = "") String outcome,
            @RequestParam(defaultValue = "") String category,
            @RequestParam(defaultValue = "") String eventType,
            @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "200") int limit,
            @AuthenticationPrincipal Jwt jwt
    ) {
        adminGuard.requireAdmin(jwt);
        return securityEventService.dashboard(
                days,
                severity,
                outcome,
                category,
                eventType,
                query,
                limit
        );
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
