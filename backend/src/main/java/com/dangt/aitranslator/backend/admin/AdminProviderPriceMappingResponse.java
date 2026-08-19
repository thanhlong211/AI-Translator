package com.dangt.aitranslator.backend.admin;

public record AdminProviderPriceMappingResponse(
        long id,
        long priceId,
        String provider,
        String providerProductId,
        String providerPriceId,
        boolean active
) {
}
