import type {
    TargetTranslationLanguage,
    TranslationLanguage
} from "./types";

export const translationLanguageLabels:
    Record<TranslationLanguage, string> = {
        AUTO: "Tự động nhận diện",
        VI: "Tiếng Việt",
        JA: "Tiếng Nhật",
        EN: "Tiếng Anh",
        KO: "Tiếng Hàn",
        ZH: "Tiếng Trung giản thể",
        ZH_TW: "Tiếng Trung phồn thể",
        FR: "Tiếng Pháp",
        DE: "Tiếng Đức",
        ES: "Tiếng Tây Ban Nha",
        TH: "Tiếng Thái",
        ID: "Tiếng Indonesia"
    };

export const sourceTranslationLanguages:
    TranslationLanguage[] = [
        "AUTO",
        "JA",
        "EN",
        "KO",
        "ZH",
        "ZH_TW",
        "VI",
        "FR",
        "DE",
        "ES",
        "TH",
        "ID"
    ];

export const targetTranslationLanguages:
    TargetTranslationLanguage[] = [
        "VI",
        "EN",
        "JA",
        "KO",
        "ZH",
        "ZH_TW",
        "FR",
        "DE",
        "ES",
        "TH",
        "ID"
    ];

export function normalizeSourceLanguage(
    value: unknown
): TranslationLanguage {
    const normalized =
        String(value || "") as TranslationLanguage;

    return sourceTranslationLanguages.includes(
        normalized
    )
        ? normalized
        : "AUTO";
}

export function normalizeTargetLanguage(
    value: unknown
): TargetTranslationLanguage {
    const normalized =
        String(value || "") as TargetTranslationLanguage;

    return targetTranslationLanguages.includes(
        normalized
    )
        ? normalized
        : "VI";
}
