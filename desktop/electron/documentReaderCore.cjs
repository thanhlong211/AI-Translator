const fs = require("fs/promises");
const path = require("path");
const {
  parseEpubBuffer,
} = require("./epubParser.cjs");

const DOCUMENT_FORMATS = Object.freeze({
  TXT: Object.freeze({
    format: "TXT",
    extensions: Object.freeze(["txt"]),
    capability: "novelReaderTxt",
    translationPurpose: "NOVEL",
    maxBytes: 8 * 1024 * 1024,
    maxSelections: 30,
    dialogTitle: "Thêm Novel TXT vào thư viện",
    dialogName: "Text / Novel",
  }),
  EPUB: Object.freeze({
    format: "EPUB",
    extensions: Object.freeze(["epub"]),
    capability: "novelReaderEpub",
    translationPurpose: "NOVEL_EPUB",
    maxBytes: 80 * 1024 * 1024,
    maxSelections: 20,
    dialogTitle: "Thêm EPUB vào thư viện",
    dialogName: "EPUB / eBook",
  }),
});

function normalizeDocumentFormat(value) {
  const clean = String(value || "")
    .trim()
    .toUpperCase();

  return Object.prototype.hasOwnProperty.call(
    DOCUMENT_FORMATS,
    clean
  )
    ? clean
    : null;
}

function detectDocumentFormatFromPath(filePathValue) {
  const extension = path.extname(
    String(filePathValue || "")
  )
    .replace(/^\./, "")
    .toLowerCase();

  for (const definition of Object.values(DOCUMENT_FORMATS)) {
    if (definition.extensions.includes(extension)) {
      return definition.format;
    }
  }

  return null;
}

function getDocumentFormatDefinition(value) {
  const format = normalizeDocumentFormat(value);

  if (!format) {
    return null;
  }

  return DOCUMENT_FORMATS[format];
}

function assertSupportedDocumentFormat(value) {
  const definition = getDocumentFormatDefinition(value);

  if (!definition) {
    throw new Error(
      "Định dạng tài liệu hiện chưa được Novel Reader hỗ trợ."
    );
  }

  return definition;
}

function resolveDocumentFormat(filePathValue, requestedFormat) {
  const requested = normalizeDocumentFormat(requestedFormat);
  const detected = detectDocumentFormatFromPath(filePathValue);

  if (requested && detected && requested !== detected) {
    throw new Error(
      `File đã chọn là ${detected}, không phải ${requested}.`
    );
  }

  return requested || detected;
}

function decodeNovelTextBuffer(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    return {
      text: "",
      encoding: "UTF-8",
    };
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xef &&
    buffer[1] === 0xbb &&
    buffer[2] === 0xbf
  ) {
    return {
      text: buffer.subarray(3).toString("utf8"),
      encoding: "UTF-8 BOM",
    };
  }

  if (
    buffer.length >= 2 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xfe
  ) {
    return {
      text: buffer.subarray(2).toString("utf16le"),
      encoding: "UTF-16 LE",
    };
  }

  if (
    buffer.length >= 2 &&
    buffer[0] === 0xfe &&
    buffer[1] === 0xff
  ) {
    const swapped = Buffer.from(buffer.subarray(2));

    for (
      let index = 0;
      index + 1 < swapped.length;
      index += 2
    ) {
      const first = swapped[index];
      swapped[index] = swapped[index + 1];
      swapped[index + 1] = first;
    }

    return {
      text: swapped.toString("utf16le"),
      encoding: "UTF-16 BE",
    };
  }

  return {
    text: buffer.toString("utf8"),
    encoding: "UTF-8",
  };
}

function isChapterHeading(text) {
  const clean = String(text || "").trim();

  if (!clean || clean.length > 90) {
    return false;
  }

  return /^(?:第\s*[0-9０-９一二三四五六七八九十百千]+\s*[章話節巻部]|chapter\s+[0-9ivxlcdm]+|chương\s+[0-9ivxlcdm]+|prologue|epilogue|序章|終章|幕間|間章)/iu
    .test(clean);
}

function splitLongText(text, maxChars = 1100) {
  const clean = String(text || "").trim();

  if (!clean) {
    return [];
  }

  if (clean.length <= maxChars) {
    return [clean];
  }

  const sentences =
    clean.match(/[^。！？!?\n]+[。！？!?]?|\n+/gu) ||
    [clean];

  const chunks = [];
  let current = "";

  function pushCurrent() {
    const value = current.trim();
    if (value) {
      chunks.push(value);
    }
    current = "";
  }

  for (const rawSentence of sentences) {
    let sentence = rawSentence.trim();

    if (!sentence) {
      continue;
    }

    while (sentence.length > maxChars) {
      if (current) {
        pushCurrent();
      }

      let splitAt = sentence.lastIndexOf(" ", maxChars);

      if (splitAt < Math.floor(maxChars * 0.55)) {
        splitAt = maxChars;
      }

      chunks.push(sentence.slice(0, splitAt).trim());
      sentence = sentence.slice(splitAt).trim();
    }

    if (!sentence) {
      continue;
    }

    const separator = current ? " " : "";

    if (
      current.length + separator.length + sentence.length >
      maxChars
    ) {
      pushCurrent();
    }

    current += (current ? " " : "") + sentence;
  }

  pushCurrent();

  return chunks;
}

function parseTxtDocument(text) {
  const normalized = String(text || "")
    .replace(/\r\n?/g, "\n")
    .replace(/^\uFEFF/, "")
    .trim();

  if (!normalized) {
    return {
      blocks: [],
      chapters: [],
    };
  }

  const rawLines = normalized.split("\n");
  const rawParagraphs = [];
  let currentLines = [];
  let currentLength = 0;

  function flushCurrent() {
    const value = currentLines.join("\n").trim();

    if (value) {
      rawParagraphs.push(value);
    }

    currentLines = [];
    currentLength = 0;
  }

  for (const rawLine of rawLines) {
    const line = rawLine.trim();

    if (!line) {
      flushCurrent();
      continue;
    }

    if (isChapterHeading(line)) {
      flushCurrent();
      rawParagraphs.push(line);
      continue;
    }

    if (
      currentLength > 0 &&
      currentLength + line.length + 1 > 1050
    ) {
      flushCurrent();
    }

    currentLines.push(line);
    currentLength += line.length + 1;
  }

  flushCurrent();

  const flattened = rawParagraphs.flatMap((paragraph) =>
    isChapterHeading(paragraph)
      ? [paragraph]
      : splitLongText(paragraph)
  );

  const blocks = flattened.map((paragraph, index) => ({
    id: `document-${index + 1}`,
    index,
    text: paragraph,
    heading: isChapterHeading(paragraph),
  }));

  return {
    blocks,
    chapters: blocks
      .filter((block) => block.heading)
      .map((block) => ({
        label: block.text,
        index: block.index,
      })),
  };
}

function normalizeDocumentBlocks(blocks) {
  if (!Array.isArray(blocks)) {
    return [];
  }

  return blocks
    .map((block, index) => ({
      ...block,
      id:
        String(block?.id || "").trim() ||
        `document-${index + 1}`,
      index,
      text: String(block?.text || "").trim(),
      heading: Boolean(block?.heading),
      html: block?.html
        ? String(block.html)
        : undefined,
      spineIndex: Number.isFinite(block?.spineIndex)
        ? Number(block.spineIndex)
        : undefined,
      sourcePath: block?.sourcePath
        ? String(block.sourcePath)
        : undefined,
    }))
    .filter((block) => Boolean(block.text));
}

function normalizeDocumentChapters(chapters, blocks) {
  const normalizedBlocks = normalizeDocumentBlocks(blocks);

  if (Array.isArray(chapters) && chapters.length) {
    return chapters
      .map((chapter) => ({
        label: String(chapter?.label || "").trim(),
        index: Math.max(0, Number(chapter?.index) || 0),
        sourcePath: chapter?.sourcePath
          ? String(chapter.sourcePath)
          : undefined,
      }))
      .filter((chapter) => Boolean(chapter.label));
  }

  return normalizedBlocks
    .filter((block) => block.heading)
    .map((block) => ({
      label: block.text,
      index: block.index,
      sourcePath: block.sourcePath,
    }));
}

function parseDocumentBuffer(definition, buffer, fileName) {
  if (definition.format === "TXT") {
    const decoded = decodeNovelTextBuffer(buffer);
    const text = String(decoded.text || "")
      .replace(/^\uFEFF/, "")
      .replace(/\u0000/g, "")
      .trim();

    if (!text) {
      throw new Error(
        "File TXT không có nội dung đọc được."
      );
    }

    const replacementCount = (text.match(/\uFFFD/g) || []).length;

    if (
      decoded.encoding === "UTF-8" &&
      replacementCount >= 3 &&
      replacementCount / text.length > 0.003
    ) {
      throw new Error(
        "Encoding TXT có vẻ không phải UTF-8 (có thể là Shift-JIS). Hãy lưu/chuyển file sang UTF-8 rồi mở lại."
      );
    }

    const parsed = parseTxtDocument(text);

    return {
      encoding: decoded.encoding,
      title: path.basename(fileName, path.extname(fileName)),
      author: "",
      language: "",
      blocks: parsed.blocks,
      chapters: parsed.chapters,
      metadata: {},
      legacyText: text,
    };
  }

  if (definition.format === "EPUB") {
    const parsed = parseEpubBuffer(buffer, fileName);

    return {
      encoding: "EPUB",
      title:
        parsed.metadata?.title ||
        path.basename(fileName, path.extname(fileName)),
      author: parsed.metadata?.author || "",
      language: parsed.metadata?.language || "",
      blocks: normalizeDocumentBlocks(parsed.blocks),
      chapters: normalizeDocumentChapters(
        parsed.chapters,
        parsed.blocks
      ),
      metadata: parsed.metadata || {},
    };
  }

  throw new Error(
    `Chưa có parser cho định dạng ${definition.format}.`
  );
}

async function readDocumentPath(
  filePathValue,
  {
    requestedFormat = null,
    requireCapability = null,
  } = {}
) {
  const filePath = path.resolve(String(filePathValue || ""));
  const format = resolveDocumentFormat(filePath, requestedFormat);
  const definition = assertSupportedDocumentFormat(format);

  if (typeof requireCapability === "function") {
    requireCapability(definition.capability);
  }

  const stat = await fs.stat(filePath);

  if (!stat.isFile()) {
    throw new Error(
      "Đường dẫn đã chọn không phải file."
    );
  }

  if (stat.size > definition.maxBytes) {
    const megabytes = Math.round(definition.maxBytes / 1024 / 1024);
    throw new Error(
      `File ${definition.format} lớn hơn ${megabytes} MB. Hãy dùng file nhẹ hơn để Reader hoạt động ổn định.`
    );
  }

  const buffer = await fs.readFile(filePath);
  const parsed = parseDocumentBuffer(
    definition,
    buffer,
    path.basename(filePath)
  );
  const blocks = normalizeDocumentBlocks(parsed.blocks);
  const chapters = normalizeDocumentChapters(
    parsed.chapters,
    blocks
  );

  if (!blocks.length) {
    throw new Error(
      `Không tìm thấy đoạn văn nào trong file ${definition.format}.`
    );
  }

  const file = {
    path: filePath,
    name: path.basename(filePath),
    sizeBytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    encoding: parsed.encoding,
    format: definition.format,
    title: parsed.title,
    author: parsed.author,
    language: parsed.language,
  };

  return {
    success: true,
    file,
    document: file,
    blocks,
    chapters,
    metadata: {
      ...(parsed.metadata || {}),
      title: parsed.title,
      author: parsed.author,
      language: parsed.language,
      format: definition.format,
    },
    // Kept temporarily so old renderer builds can still consume TXT payloads.
    ...(parsed.legacyText
      ? { text: parsed.legacyText }
      : {}),
  };
}

async function openDocumentFiles(
  {
    dialog,
    ownerWindow,
    requestedFormat,
    requireCapability = null,
  }
) {
  const definition = assertSupportedDocumentFormat(requestedFormat);

  if (typeof requireCapability === "function") {
    requireCapability(definition.capability);
  }

  const dialogOptions = {
    title: definition.dialogTitle,
    properties: [
      "openFile",
      "multiSelections",
    ],
    filters: [
      {
        name: definition.dialogName,
        extensions: [...definition.extensions],
      },
    ],
  };

  const result = ownerWindow
    ? await dialog.showOpenDialog(ownerWindow, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);

  if (result.canceled || !result.filePaths?.length) {
    return {
      success: false,
      canceled: true,
    };
  }

  const items = [];
  const errors = [];

  for (const selectedPath of result.filePaths.slice(
    0,
    definition.maxSelections
  )) {
    try {
      items.push(
        await readDocumentPath(selectedPath, {
          requestedFormat: definition.format,
          requireCapability,
        })
      );
    } catch (error) {
      errors.push({
        path: selectedPath,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }

  if (!items.length) {
    throw new Error(
      errors[0]?.error ||
      `Không mở được file ${definition.format} nào.`
    );
  }

  return {
    ...items[0],
    files: items,
    errors,
  };
}

function getTranslationRouteForFormat(value) {
  const definition = assertSupportedDocumentFormat(value);

  return {
    format: definition.format,
    capability: definition.capability,
    purpose: definition.translationPurpose,
  };
}

function listDocumentFormats() {
  return Object.values(DOCUMENT_FORMATS).map((definition) => ({
    format: definition.format,
    extensions: [...definition.extensions],
    capability: definition.capability,
    translationPurpose: definition.translationPurpose,
    maxBytes: definition.maxBytes,
  }));
}

module.exports = {
  DOCUMENT_FORMATS,
  normalizeDocumentFormat,
  detectDocumentFormatFromPath,
  getDocumentFormatDefinition,
  getTranslationRouteForFormat,
  listDocumentFormats,
  normalizeDocumentBlocks,
  readDocumentPath,
  openDocumentFiles,
  parseTxtDocument,
};
