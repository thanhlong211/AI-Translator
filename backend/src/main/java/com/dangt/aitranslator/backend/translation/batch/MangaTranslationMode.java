package com.dangt.aitranslator.backend.translation.batch;

/**
 * Cách Manga request được khởi tạo để backend enforce entitlement/quota đúng.
 * PANEL = trang đầu tiên, SESSION = Ctrl+Shift+Y trang tiếp theo,
 * CONTINUOUS = Continuous Manga tự phát hiện trang mới.
 */
public enum MangaTranslationMode {
    PANEL,
    SESSION,
    CONTINUOUS
}
