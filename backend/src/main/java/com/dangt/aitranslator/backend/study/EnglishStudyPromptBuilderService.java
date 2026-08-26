package com.dangt.aitranslator.backend.study;

import com.dangt.aitranslator.backend.profile.TranslationProfile;
import com.dangt.aitranslator.backend.translation.TranslationContextItem;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class EnglishStudyPromptBuilderService {

    private static final String STATIC_PREFIX = """
            Bạn là English Study Analysis Engine của AI Translator Desktop.

            MỤC TIÊU:
            Phân tích một câu hoặc đoạn tiếng Anh cho người Việt học tiếng Anh.

            OUTPUT CONTRACT:
            - Structured Output được ép bằng JSON Schema.
            - original giữ nguyên nội dung nguồn.
            - ipa là IPA của câu.
            - translation là bản dịch tiếng Việt.
            - cefrLevel chỉ A1, A2, B1, B2, C1, C2 hoặc UNKNOWN.
            - Không tạo Hiragana.
            - Không tạo Romaji.
            - Không sử dụng JLPT.
            - Giải thích bằng tiếng Việt ngắn và dễ hiểu.

            VOCABULARY:
            - surface: dạng xuất hiện.
            - lemma: dạng từ điển.
            - ipa: IPA của từ.
            - meaning: nghĩa trong ngữ cảnh.
            - partOfSpeech: loại từ.
            - cefrLevel: CEFR.
            - example: ví dụ tiếng Anh tự nhiên.

            GRAMMAR:
            - Tối đa 6 điểm đáng học.
            - matchedText phải có trong source.
            - explanation bằng tiếng Việt.
            - example ngắn.

            COLLOCATIONS:
            - Tối đa 6 cụm thực sự có giá trị học tập.

            COMMON MISTAKES:
            - Tối đa 4 lỗi phổ biến liên quan tới cấu trúc của câu.
            - Không bịa lỗi.

            BUDGET:
            - sentenceSummary tối đa 1 câu.
            - sentenceParts tối đa 12.
            - vocabulary tối đa 15.
            - notes tối đa 3.
            - Không lặp thông tin không cần thiết.

            """;


    public String build(
            TranslationProfile profile,
            String sourceText,
            List<TranslationContextItem> context
    ) {
        return build(
                profile,
                sourceText,
                StudyLevel.AUTO,
                context
        );
    }


    public String build(
            TranslationProfile profile,
            String sourceText,
            StudyLevel level,
            List<TranslationContextItem> context
    ) {
        StringBuilder prompt =
                new StringBuilder(
                        STATIC_PREFIX
                );

        appendLevel(
                prompt,
                level
        );

        appendProfile(
                prompt,
                profile
        );

        appendContext(
                prompt,
                profile,
                context
        );

        prompt.append(
                "\n<source_text>\n"
        );

        prompt.append(
                safe(sourceText)
        );

        prompt.append("""
                
                </source_text>

                Hoàn thành English Structured Study Analysis.
                """);

        return prompt.toString();
    }


    private void appendLevel(
            StringBuilder prompt,
            StudyLevel level
    ) {
        StudyLevel resolved =
                level == null
                        ? StudyLevel.AUTO
                        : level;

        prompt.append(
                "LEARNER_LEVEL: "
        ).append(
                resolved.name()
        ).append('\n');

        switch (resolved) {

            case A1, A2, B1, B2, C1, C2 -> {
                prompt.append(
                        "Giải thích phù hợp người học CEFR "
                ).append(
                        resolved.name()
                ).append(".\n");
            }

            default -> {
                prompt.append(
                        "Tự đánh giá CEFR và giải thích vừa đủ.\n"
                );
            }
        }
    }


    private void appendProfile(
            StringBuilder prompt,
            TranslationProfile profile
    ) {
        if (profile == null) {
            return;
        }

        prompt.append(
                "\nPROFILE: "
        ).append(
                safe(
                        profile.getName()
                )
        ).append('\n');


        if (
                profile.getCustomInstruction() != null &&
                !profile
                        .getCustomInstruction()
                        .isBlank()
        ) {
            prompt.append(
                    "\n<profile_instructions>\n"
            );

            prompt.append(
                    limit(
                            profile
                                    .getCustomInstruction()
                                    .trim(),
                            3000
                    )
            );

            prompt.append(
                    "\n</profile_instructions>\n"
            );
        }


        if (
                profile.getGlossary() == null ||
                profile.getGlossary()
                        .isEmpty()
        ) {
            return;
        }

        prompt.append(
                "\nGLOSSARY:\n"
        );

        profile.getGlossary()
                .stream()
                .limit(50)
                .forEach(entry -> {

                    prompt.append("- ")
                            .append(
                                    limit(
                                            safe(
                                                    entry.getSource()
                                            ),
                                            120
                                    )
                            )
                            .append(" -> ")
                            .append(
                                    limit(
                                            safe(
                                                    entry.getTarget()
                                            ),
                                            160
                                    )
                            );

                    if (
                            entry.getNote() != null &&
                            !entry.getNote()
                                    .isBlank()
                    ) {
                        prompt.append(" (")
                                .append(
                                        limit(
                                                entry
                                                        .getNote()
                                                        .trim(),
                                                300
                                        )
                                )
                                .append(')');
                    }

                    prompt.append('\n');
                });
    }


    private void appendContext(
            StringBuilder prompt,
            TranslationProfile profile,
            List<TranslationContextItem> context
    ) {
        if (
                profile == null ||
                context == null ||
                context.isEmpty()
        ) {
            return;
        }

        int max =
                Math.max(
                        0,
                        Math.min(
                                10,
                                profile.getContextLines()
                        )
                );

        if (max == 0) {
            return;
        }

        int start =
                Math.max(
                        0,
                        context.size() - max
                );

        prompt.append(
                "\nCONTEXT:\n"
        );

        for (
                int index = start;
                index < context.size();
                index++
        ) {
            TranslationContextItem item =
                    context.get(index);

            String original =
                    limit(
                            safe(
                                    item.original()
                            ),
                            1000
                    );

            String vietnamese =
                    limit(
                            safe(
                                    item.vietnamese()
                            ),
                            1000
                    );

            if (
                    original.isBlank() &&
                    vietnamese.isBlank()
            ) {
                continue;
            }

            prompt.append("- EN: ")
                    .append(original)
                    .append('\n');

            if (!vietnamese.isBlank()) {
                prompt.append("  VI: ")
                        .append(vietnamese)
                        .append('\n');
            }
        }
    }


    private String safe(
            String value
    ) {
        return value == null
                ? ""
                : value.trim();
    }


    private String limit(
            String value,
            int maxLength
    ) {
        String clean =
                safe(value);

        if (
                clean.length()
                        <= maxLength
        ) {
            return clean;
        }

        return clean.substring(
                0,
                maxLength
        );
    }
}
