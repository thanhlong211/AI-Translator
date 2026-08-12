package com.dangt.aitranslator.backend.translation.batch;

/**
 * Mục đích của batch request để backend áp feature entitlement đúng use case.
 * GENERAL giữ tương thích với Full Screen/legacy batch; MANGA yêu cầu mangaPanel.
 */
public enum BatchTranslationPurpose {
    GENERAL,
    MANGA
}
