package com.dangt.aitranslator.backend.translation;

/**
 * Ngôn ngữ được Translation Engine hỗ trợ ở tầng API.
 *
 * AUTO chỉ hợp lệ cho sourceLanguage. targetLanguage mặc định là VI
 * để giữ tương thích với client hiện tại.
 */
public enum TranslationLanguage {
    AUTO("Tự động nhận diện", "the detected source language"),
    VI("Tiếng Việt", "Vietnamese"),
    JA("Tiếng Nhật", "Japanese"),
    EN("Tiếng Anh", "English"),
    KO("Tiếng Hàn", "Korean"),
    ZH("Tiếng Trung giản thể", "Simplified Chinese"),
    ZH_TW("Tiếng Trung phồn thể", "Traditional Chinese"),
    FR("Tiếng Pháp", "French"),
    DE("Tiếng Đức", "German"),
    ES("Tiếng Tây Ban Nha", "Spanish"),
    TH("Tiếng Thái", "Thai"),
    ID("Tiếng Indonesia", "Indonesian");

    private final String displayName;
    private final String promptName;

    TranslationLanguage(
            String displayName,
            String promptName
    ) {
        this.displayName = displayName;
        this.promptName = promptName;
    }

    public String displayName() {
        return displayName;
    }

    public String promptName() {
        return promptName;
    }
}
