const path = require("path");
const zlib = require("zlib");

const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const MAX_EOCD_SEARCH = 0xffff + 22;
const MAX_EPUB_ENTRY_BYTES = 24 * 1024 * 1024;

function normalizeZipPath(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/\.\//g, "/");
}

function safeCodePoint(value, radix) {
  const codePoint = Number.parseInt(value, radix);
  if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return "";
  }
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return "";
  }
}

function decodeXmlEntities(value) {
  return String(value || "")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) =>
      safeCodePoint(hex, 16)
    )
    .replace(/&#([0-9]+);/g, (_match, decimal) =>
      safeCodePoint(decimal, 10)
    )
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'");
}

function stripTags(value) {
  return decodeXmlEntities(
    String(value || "")
      .replace(/<rt\b[^>]*>[\s\S]*?<\/rt\s*>/gi, "")
      .replace(/<rp\b[^>]*>[\s\S]*?<\/rp\s*>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/[\t\r ]+/g, " ")
    .replace(/\n[\t ]+/g, "\n")
    .trim();
}

function sanitizeInlineHtml(value) {
  const source = String(value || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<svg\b[\s\S]*?<\/svg\s*>/gi, "")
    .replace(/<math\b[\s\S]*?<\/math\s*>/gi, "");

  return source
    .replace(/<\s*(\/?)\s*([a-z0-9:-]+)(?:\s[^>]*)?>/gi, (_match, slash, rawTag) => {
      const tag = String(rawTag || "").toLowerCase();
      const allowed = new Set([
        "strong",
        "b",
        "em",
        "i",
        "br",
        "ruby",
        "rt",
        "rp",
        "sup",
        "sub",
      ]);

      if (!allowed.has(tag)) {
        return "";
      }

      if (tag === "br") {
        return "<br>";
      }

      return slash ? `</${tag}>` : `<${tag}>`;
    })
    .trim();
}

function decodeXmlBuffer(buffer) {
  if (
    buffer.length >= 2 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xfe
  ) {
    return buffer.subarray(2).toString("utf16le");
  }

  if (
    buffer.length >= 2 &&
    buffer[0] === 0xfe &&
    buffer[1] === 0xff
  ) {
    const swapped = Buffer.from(buffer.subarray(2));
    for (let index = 0; index + 1 < swapped.length; index += 2) {
      const first = swapped[index];
      swapped[index] = swapped[index + 1];
      swapped[index + 1] = first;
    }
    return swapped.toString("utf16le");
  }

  return buffer.toString("utf8").replace(/^\uFEFF/, "");
}

function findEndOfCentralDirectory(buffer) {
  const minOffset = Math.max(0, buffer.length - MAX_EOCD_SEARCH);
  for (let offset = buffer.length - 22; offset >= minOffset; offset--) {
    if (buffer.readUInt32LE(offset) === ZIP_END_OF_CENTRAL_DIRECTORY) {
      return offset;
    }
  }
  throw new Error("EPUB ZIP không có End Of Central Directory hợp lệ.");
}

function parseZipEntries(buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = new Map();
  let cursor = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index++) {
    if (
      cursor + 46 > buffer.length ||
      buffer.readUInt32LE(cursor) !== ZIP_CENTRAL_DIRECTORY_HEADER
    ) {
      throw new Error("EPUB ZIP central directory bị hỏng.");
    }

    const flags = buffer.readUInt16LE(cursor + 8);
    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const nameBuffer = buffer.subarray(cursor + 46, cursor + 46 + fileNameLength);
    const name = normalizeZipPath(
      nameBuffer.toString(flags & 0x800 ? "utf8" : "utf8")
    );

    if (name && !name.endsWith("/")) {
      entries.set(name, {
        name,
        compressionMethod,
        compressedSize,
        uncompressedSize,
        localHeaderOffset,
        encrypted: Boolean(flags & 0x1),
      });
    }

    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function readZipEntry(buffer, entry) {
  if (!entry) {
    throw new Error("Không tìm thấy file bên trong EPUB.");
  }
  if (entry.encrypted) {
    throw new Error("EPUB được mã hóa/DRM nên không thể đọc trực tiếp.");
  }
  if (
    entry.uncompressedSize > MAX_EPUB_ENTRY_BYTES ||
    entry.compressedSize > MAX_EPUB_ENTRY_BYTES
  ) {
    throw new Error(`EPUB entry quá lớn để đọc an toàn: ${entry.name}`);
  }

  const offset = entry.localHeaderOffset;
  if (
    offset + 30 > buffer.length ||
    buffer.readUInt32LE(offset) !== ZIP_LOCAL_FILE_HEADER
  ) {
    throw new Error(`EPUB local header lỗi: ${entry.name}`);
  }

  const fileNameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + fileNameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;

  if (dataEnd > buffer.length) {
    throw new Error(`EPUB entry vượt kích thước file: ${entry.name}`);
  }

  const compressed = buffer.subarray(dataStart, dataEnd);
  let output;

  if (entry.compressionMethod === 0) {
    output = Buffer.from(compressed);
  } else if (entry.compressionMethod === 8) {
    output = zlib.inflateRawSync(compressed, {
      maxOutputLength: MAX_EPUB_ENTRY_BYTES,
    });
  } else {
    throw new Error(
      `EPUB dùng ZIP compression method ${entry.compressionMethod} chưa hỗ trợ.`
    );
  }

  if (
    entry.uncompressedSize &&
    output.length !== entry.uncompressedSize
  ) {
    // Some EPUB generators write imperfect size metadata. Keep the decoded
    // bytes when decompression itself succeeded instead of failing hard.
  }

  return output;
}

function attributeValue(tag, name) {
  const match = String(tag || "").match(
    new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i")
  );
  return match ? decodeXmlEntities(match[1]).trim() : "";
}

function resolveManifestPath(opfPath, href) {
  const cleanHref = String(href || "").split("#")[0].split("?")[0];
  let decoded = cleanHref;
  try {
    decoded = decodeURIComponent(cleanHref);
  } catch {
    // Keep original href when malformed percent escapes are present.
  }
  return normalizeZipPath(
    path.posix.normalize(
      path.posix.join(path.posix.dirname(opfPath), decoded)
    )
  );
}

function parseContainerPath(containerXml) {
  const rootfile = String(containerXml || "").match(/<rootfile\b[^>]*>/i)?.[0];
  const fullPath = attributeValue(rootfile, "full-path");
  if (!fullPath) {
    throw new Error("EPUB không khai báo OPF trong META-INF/container.xml.");
  }
  return normalizeZipPath(fullPath);
}

function parseOpf(opfXml, opfPath) {
  const xml = String(opfXml || "");
  const title = stripTags(
    xml.match(/<dc:title\b[^>]*>([\s\S]*?)<\/dc:title\s*>/i)?.[1] || ""
  );
  const author = stripTags(
    xml.match(/<dc:creator\b[^>]*>([\s\S]*?)<\/dc:creator\s*>/i)?.[1] || ""
  );
  const language = stripTags(
    xml.match(/<dc:language\b[^>]*>([\s\S]*?)<\/dc:language\s*>/i)?.[1] || ""
  );

  const manifest = new Map();
  for (const match of xml.matchAll(/<item\b[^>]*>/gi)) {
    const tag = match[0];
    const id = attributeValue(tag, "id");
    const href = attributeValue(tag, "href");
    if (!id || !href) continue;
    manifest.set(id, {
      id,
      href,
      path: resolveManifestPath(opfPath, href),
      mediaType: attributeValue(tag, "media-type"),
      properties: attributeValue(tag, "properties"),
    });
  }

  const spine = [];
  const spineTag = xml.match(/<spine\b[^>]*>/i)?.[0] || "";
  const tocId = attributeValue(spineTag, "toc");
  for (const match of xml.matchAll(/<itemref\b[^>]*>/gi)) {
    const idref = attributeValue(match[0], "idref");
    const item = manifest.get(idref);
    if (item) spine.push(item);
  }

  const navItem = [...manifest.values()].find((item) =>
    String(item.properties || "").split(/\s+/).includes("nav")
  );
  const ncxItem =
    (tocId && manifest.get(tocId)) ||
    [...manifest.values()].find(
      (item) => item.mediaType === "application/x-dtbncx+xml"
    );

  return {
    title,
    author,
    language,
    manifest,
    spine,
    navItem,
    ncxItem,
  };
}

function parseNavigation(xml, navPath, isNcx = false) {
  const labels = new Map();
  const source = String(xml || "");

  if (isNcx) {
    for (const match of source.matchAll(/<navPoint\b[\s\S]*?<\/navPoint\s*>/gi)) {
      const block = match[0];
      const srcTag = block.match(/<content\b[^>]*>/i)?.[0] || "";
      const src = attributeValue(srcTag, "src");
      const label = stripTags(
        block.match(/<navLabel\b[^>]*>[\s\S]*?<text\b[^>]*>([\s\S]*?)<\/text\s*>[\s\S]*?<\/navLabel\s*>/i)?.[1] || ""
      );
      if (src && label) {
        labels.set(resolveManifestPath(navPath, src), label);
      }
    }
    return labels;
  }

  for (const match of source.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a\s*>/gi)) {
    const href = decodeXmlEntities(match[1]);
    const label = stripTags(match[2]);
    if (href && label) {
      labels.set(resolveManifestPath(navPath, href), label);
    }
  }
  return labels;
}

function splitLongPlainText(text, maxChars = 1100) {
  const clean = String(text || "").trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const output = [];
  let rest = clean;
  while (rest.length > maxChars) {
    let splitAt = Math.max(
      rest.lastIndexOf("。", maxChars),
      rest.lastIndexOf("！", maxChars),
      rest.lastIndexOf("？", maxChars),
      rest.lastIndexOf(". ", maxChars),
      rest.lastIndexOf(" ", maxChars)
    );
    if (splitAt < Math.floor(maxChars * 0.55)) splitAt = maxChars;
    else splitAt += 1;
    output.push(rest.slice(0, splitAt).trim());
    rest = rest.slice(splitAt).trim();
  }
  if (rest) output.push(rest);
  return output;
}

function extractDocumentBlocks(xhtml, chapterLabel) {
  const source = String(xhtml || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<head\b[\s\S]*?<\/head\s*>/gi, "");
  const blocks = [];
  const tagPattern = /<(h[1-6]|p|blockquote|li)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi;

  for (const match of source.matchAll(tagPattern)) {
    const tag = String(match[1] || "").toLowerCase();
    const inner = match[2] || "";
    const text = stripTags(inner);
    if (!text) continue;

    const heading = tag.startsWith("h");
    const chunks = splitLongPlainText(text);
    if (!chunks.length) continue;

    if (chunks.length === 1) {
      blocks.push({
        text,
        html: sanitizeInlineHtml(inner),
        heading,
      });
    } else {
      for (const chunk of chunks) {
        blocks.push({ text: chunk, html: "", heading: false });
      }
    }
  }

  const firstHeading = blocks.find((block) => block.heading)?.text || "";
  if (
    chapterLabel &&
    chapterLabel.trim() &&
    (!firstHeading || firstHeading.trim() !== chapterLabel.trim())
  ) {
    blocks.unshift({
      text: chapterLabel.trim(),
      html: "",
      heading: true,
    });
  }

  if (!blocks.length) {
    const body = source.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i)?.[1] || source;
    const text = stripTags(body);
    for (const chunk of splitLongPlainText(text)) {
      blocks.push({ text: chunk, html: "", heading: false });
    }
  }

  return blocks;
}

function parseEpubBuffer(buffer, fallbackName = "book.epub") {
  const entries = parseZipEntries(buffer);
  const containerEntry = entries.get("META-INF/container.xml");
  if (!containerEntry) {
    throw new Error("File không phải EPUB hợp lệ: thiếu META-INF/container.xml.");
  }

  const containerXml = decodeXmlBuffer(readZipEntry(buffer, containerEntry));
  const opfPath = parseContainerPath(containerXml);
  const opfEntry = entries.get(opfPath);
  if (!opfEntry) {
    throw new Error(`EPUB thiếu package document: ${opfPath}`);
  }

  const opfXml = decodeXmlBuffer(readZipEntry(buffer, opfEntry));
  const packageInfo = parseOpf(opfXml, opfPath);
  if (!packageInfo.spine.length) {
    throw new Error("EPUB không có spine đọc được.");
  }

  const navigationLabels = new Map();
  if (packageInfo.navItem && entries.has(packageInfo.navItem.path)) {
    const navXml = decodeXmlBuffer(readZipEntry(buffer, entries.get(packageInfo.navItem.path)));
    for (const [key, value] of parseNavigation(navXml, packageInfo.navItem.path, false)) {
      navigationLabels.set(key, value);
    }
  }
  if (packageInfo.ncxItem && entries.has(packageInfo.ncxItem.path)) {
    const ncxXml = decodeXmlBuffer(readZipEntry(buffer, entries.get(packageInfo.ncxItem.path)));
    for (const [key, value] of parseNavigation(ncxXml, packageInfo.ncxItem.path, true)) {
      if (!navigationLabels.has(key)) navigationLabels.set(key, value);
    }
  }

  const blocks = [];
  const chapters = [];
  let spineIndex = 0;

  for (const item of packageInfo.spine) {
    spineIndex++;
    const entry = entries.get(item.path);
    if (!entry) continue;
    if (!/xhtml|html|xml/i.test(item.mediaType || "") && !/\.(xhtml?|html?)$/i.test(item.path)) {
      continue;
    }

    const xhtml = decodeXmlBuffer(readZipEntry(buffer, entry));
    const chapterLabel = navigationLabels.get(item.path) || "";
    const documentBlocks = extractDocumentBlocks(xhtml, chapterLabel);
    if (!documentBlocks.length) continue;

    const chapterStart = blocks.length;
    for (let localIndex = 0; localIndex < documentBlocks.length; localIndex++) {
      const block = documentBlocks[localIndex];
      blocks.push({
        id: `epub-${spineIndex}-${localIndex + 1}`,
        index: blocks.length,
        text: block.text,
        html: block.html,
        heading: Boolean(block.heading),
        spineIndex,
        sourcePath: item.path,
      });
    }

    const label =
      chapterLabel ||
      documentBlocks.find((block) => block.heading)?.text ||
      `Phần ${spineIndex}`;
    chapters.push({
      label,
      index: chapterStart,
      sourcePath: item.path,
    });
  }

  if (!blocks.length) {
    throw new Error("EPUB không có nội dung văn bản đọc được trong spine.");
  }

  return {
    metadata: {
      title: packageInfo.title || String(fallbackName || "").replace(/\.epub$/i, ""),
      author: packageInfo.author || "",
      language: packageInfo.language || "",
    },
    blocks,
    chapters,
  };
}

module.exports = {
  parseEpubBuffer,
};
