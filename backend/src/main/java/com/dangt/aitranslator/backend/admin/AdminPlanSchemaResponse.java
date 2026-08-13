package com.dangt.aitranslator.backend.admin;

import java.util.List;

public record AdminPlanSchemaResponse(
        List<String> featureKeys,
        List<String> limitKeys
) {
}
