package com.dangt.aitranslator.backend.catalog;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/catalog")
@Tag(name = "Public Catalog", description = "Danh sách plan và giá đang được mở bán.")
public class PublicPricingCatalogController {

    private final PublicPricingCatalogService catalogService;

    public PublicPricingCatalogController(
            PublicPricingCatalogService catalogService
    ) {
        this.catalogService = catalogService;
    }

    @GetMapping("/plans")
    @Operation(summary = "Danh sách plan active và giá đang bán")
    public List<PublicCatalogPlanResponse> plans(
            @RequestParam(required = false) String currency
    ) {
        return catalogService.listPlans(currency);
    }

    @GetMapping("/plans/{planCode}")
    @Operation(summary = "Chi tiết một plan trong public catalog")
    public PublicCatalogPlanResponse plan(
            @PathVariable String planCode,
            @RequestParam(required = false) String currency
    ) {
        return catalogService.plan(planCode, currency);
    }
}
