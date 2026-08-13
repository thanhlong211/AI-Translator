export type DocumentReaderFormat = "TXT" | "EPUB";

export interface DocumentReaderFileInfo {
    path: string;
    name: string;
    sizeBytes: number;
    modifiedAt: string;
    encoding: string;
    format?: DocumentReaderFormat;
    title?: string;
    author?: string;
    language?: string;
}

export interface DocumentReaderBlock {
    id: string;
    index: number;
    text: string;
    heading: boolean;
    html?: string;
    spineIndex?: number;
    sourcePath?: string;
}

export interface DocumentReaderChapter {
    label: string;
    index: number;
    sourcePath?: string;
}

export interface DocumentReaderOpenPayload {
    success: boolean;
    canceled?: boolean;
    file?: DocumentReaderFileInfo;
    document?: DocumentReaderFileInfo;
    text?: string;
    blocks?: DocumentReaderBlock[];
    chapters?: DocumentReaderChapter[];
    metadata?: {
        title?: string;
        author?: string;
        language?: string;
        format?: DocumentReaderFormat;
    };
    error?: string;
}

export interface DocumentReaderFormatDescriptor {
    format: DocumentReaderFormat;
    extensions: string[];
    capability: string;
    translationPurpose: string;
    maxBytes: number;
}

export const documentReaderFormats: ReadonlyArray<DocumentReaderFormat> = [
    "TXT",
    "EPUB"
] as const;

export function normalizeDocumentReaderFormat(
    value: unknown,
    fallback: DocumentReaderFormat = "TXT"
): DocumentReaderFormat {
    return String(value || "").toUpperCase() === "EPUB"
        ? "EPUB"
        : fallback;
}

export function normalizeDocumentReaderBlocks(
    blocks: unknown
): DocumentReaderBlock[] {
    if (!Array.isArray(blocks)) {
        return [];
    }

    return blocks
        .map((raw, index) => {
            const block = (raw || {}) as Partial<DocumentReaderBlock>;
            const text = String(block.text || "").trim();

            return {
                ...block,
                id:
                    String(block.id || "").trim() ||
                    `document-${index + 1}`,
                index,
                text,
                heading: Boolean(block.heading),
                html: block.html
                    ? String(block.html)
                    : undefined,
                spineIndex: Number.isFinite(block.spineIndex)
                    ? Number(block.spineIndex)
                    : undefined,
                sourcePath: block.sourcePath
                    ? String(block.sourcePath)
                    : undefined
            } as DocumentReaderBlock;
        })
        .filter((block) => Boolean(block.text));
}

export function normalizeDocumentReaderPayload(
    payload: DocumentReaderOpenPayload
): DocumentReaderOpenPayload {
    const file = payload.file || payload.document;

    return {
        ...payload,
        file,
        document: file,
        blocks: normalizeDocumentReaderBlocks(payload.blocks),
        chapters: Array.isArray(payload.chapters)
            ? payload.chapters
                  .map((chapter) => ({
                      label: String(chapter?.label || "").trim(),
                      index: Math.max(0, Number(chapter?.index) || 0),
                      sourcePath: chapter?.sourcePath
                          ? String(chapter.sourcePath)
                          : undefined
                  }))
                  .filter((chapter) => Boolean(chapter.label))
            : []
    };
}
