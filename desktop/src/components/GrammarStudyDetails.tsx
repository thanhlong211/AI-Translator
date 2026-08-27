interface GrammarStudyDetailsProps {
    matchedText?: string | null;
    explanation?: string | null;
    example?: string | null;
}


interface GrammarExplanationPart {
    label: string;
    value: string;
}


function clean(
    value?: string | null
) {
    return String(
        value || ""
    ).trim();
}


function parseExplanation(
    value?: string | null
): GrammarExplanationPart[] {
    const text =
        clean(value);

    if (!text) {
        return [];
    }

    const pieces =
        text
            .split(
                /\s*\|\s*/
            )
            .map(
                (item) =>
                    item.trim()
            )
            .filter(Boolean);

    const result:
        GrammarExplanationPart[] = [];

    for (
        const piece
        of pieces
    ) {
        const colon =
            piece.indexOf(":");

        if (colon <= 0) {
            continue;
        }

        const label =
            piece
                .slice(
                    0,
                    colon
                )
                .trim();

        const partValue =
            piece
                .slice(
                    colon + 1
                )
                .trim();

        if (
            label &&
            partValue
        ) {
            result.push({
                label,
                value:
                    partValue
            });
        }
    }

    /*
     * Nếu AI không dùng format
     * "Cấu tạo | Cách dùng | ..."
     * thì giữ nguyên explanation.
     */
    if (
        result.length === 0
    ) {
        return [
            {
                label:
                    "Giải thích",
                value:
                    text
            }
        ];
    }

    return result;
}


function parseExample(
    value?: string | null
) {
    const text =
        clean(value);

    if (!text) {
        return {
            source: "",
            translation: ""
        };
    }

    const parts =
        text.split(
            /\s*→\s*/
        );

    if (
        parts.length <= 1
    ) {
        return {
            source:
                text,
            translation:
                ""
        };
    }

    return {
        source:
            clean(
                parts.shift()
            ),

        translation:
            clean(
                parts.join(
                    " → "
                )
            )
    };
}


export function GrammarStudyDetails({
    matchedText,
    explanation,
    example
}: GrammarStudyDetailsProps) {

    const signal =
        clean(
            matchedText
        );

    const explanationParts =
        parseExplanation(
            explanation
        );

    const parsedExample =
        parseExample(
            example
        );

    if (
        !signal &&
        explanationParts.length === 0 &&
        !parsedExample.source
    ) {
        return null;
    }

    return (
        <div className="grammar-study-details">
            {signal && (
                <div className="vocab-note">
                    <strong>
                        Dấu hiệu trong câu
                    </strong>

                    <div>
                        {signal}
                    </div>
                </div>
            )}

            {explanationParts.map(
                (
                    part,
                    index
                ) => (
                    <div
                        className="vocab-note"
                        key={
                            `${part.label}-${index}`
                        }
                    >
                        <strong>
                            {part.label}
                        </strong>

                        <div>
                            {part.value}
                        </div>
                    </div>
                )
            )}

            {parsedExample.source && (
                <div className="vocab-note">
                    <strong>
                        Ví dụ
                    </strong>

                    <div>
                        {
                            parsedExample
                                .source
                        }
                    </div>

                    {parsedExample.translation && (
                        <div>
                            →{" "}
                            {
                                parsedExample
                                    .translation
                            }
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
