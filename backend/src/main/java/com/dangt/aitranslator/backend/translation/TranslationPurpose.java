package com.dangt.aitranslator.backend.translation;

/**
 * Distinguishes direct /translate use cases for AI cost analytics.
 * Old clients omit this field and remain QUICK_TRANSLATE.
 */
public enum TranslationPurpose {
    QUICK_TRANSLATE,
    STUDY_FAST
}
