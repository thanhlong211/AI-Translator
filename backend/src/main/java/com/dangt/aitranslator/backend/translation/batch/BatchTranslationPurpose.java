package com.dangt.aitranslator.backend.translation.batch;

/**
 * Mục đích của batch request để backend áp feature entitlement đúng use case
 * và xây prompt phù hợp.
 */
public enum BatchTranslationPurpose {
    GENERAL,
    MANGA,
    NOVEL
}
