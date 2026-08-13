package com.dangt.aitranslator.backend.catalog;

import java.util.List;
import java.util.Map;

public record PublicCatalogPlanResponse(
        String code,
        String displayName,
        String description,
        int rankOrder,
        Map<String, Boolean> features,
        Map<String, Long> limits,
        List<PublicCatalogPriceResponse> prices
) {
}
