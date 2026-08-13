const zlib = require("zlib");

const MAX_PDF_BYTES = 100 * 1024 * 1024;
const MAX_STREAM_BYTES = 24 * 1024 * 1024;
const DIRECT_UTF16BE = Symbol("DIRECT_UTF16BE");

function decodePdfName(value) {
  return String(value || "").replace(/#([0-9A-Fa-f]{2})/g, (_m, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

function decodePdfLiteralStringToken(token) {
  const raw = String(token || "");
  if (!raw.startsWith("(") || !raw.endsWith(")")) {
    return Buffer.alloc(0);
  }
  const body = raw.slice(1, -1);
  const bytes = [];
  for (let i = 0; i < body.length; i += 1) {
    const code = body.charCodeAt(i) & 0xff;
    if (code !== 0x5c) {
      bytes.push(code);
      continue;
    }
    if (i + 1 >= body.length) {
      break;
    }
    const next = body[++i];
    const escapes = {
      n: 0x0a,
      r: 0x0d,
      t: 0x09,
      b: 0x08,
      f: 0x0c,
      "(": 0x28,
      ")": 0x29,
      "\\": 0x5c,
    };
    if (Object.prototype.hasOwnProperty.call(escapes, next)) {
      bytes.push(escapes[next]);
      continue;
    }
    if (/^[0-7]$/.test(next)) {
      let octal = next;
      for (let count = 0; count < 2 && i + 1 < body.length && /^[0-7]$/.test(body[i + 1]); count += 1) {
        octal += body[++i];
      }
      bytes.push(parseInt(octal, 8) & 0xff);
      continue;
    }
    if (next === "\n") {
      continue;
    }
    if (next === "\r") {
      if (body[i + 1] === "\n") i += 1;
      continue;
    }
    bytes.push(next.charCodeAt(0) & 0xff);
  }
  return Buffer.from(bytes);
}

function decodeHexToken(token) {
  let hex = String(token || "")
    .replace(/^</, "")
    .replace(/>$/, "")
    .replace(/\s+/g, "");
  if (hex.length % 2) hex += "0";
  return Buffer.from(hex, "hex");
}

function decodeUtf16Be(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) return "";
  let start = 0;
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) start = 2;
  const swapped = Buffer.from(buffer.subarray(start));
  for (let i = 0; i + 1 < swapped.length; i += 2) {
    const tmp = swapped[i];
    swapped[i] = swapped[i + 1];
    swapped[i + 1] = tmp;
  }
  return swapped.toString("utf16le").replace(/^\uFEFF/, "");
}

const CP1252 = Object.freeze({
  0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†", 0x87: "‡",
  0x88: "ˆ", 0x89: "‰", 0x8a: "Š", 0x8b: "‹", 0x8c: "Œ", 0x8e: "Ž", 0x91: "‘",
  0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—", 0x98: "˜",
  0x99: "™", 0x9a: "š", 0x9b: "›", 0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ",
});

function decodeSingleByte(buffer) {
  let result = "";
  for (const byte of buffer || []) {
    if (byte >= 0x80 && byte <= 0x9f && CP1252[byte]) {
      result += CP1252[byte];
    } else {
      result += String.fromCharCode(byte);
    }
  }
  return result;
}

function parseIndirectObjects(buffer) {
  const source = buffer.toString("latin1");
  const objects = new Map();
  const regex = /(^|[\r\n])\s*(\d+)\s+(\d+)\s+obj\b/gm;
  const starts = [];
  let match;
  while ((match = regex.exec(source))) {
    starts.push({ id: Number(match[2]), gen: Number(match[3]), bodyStart: regex.lastIndex });
  }
  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i];
    const nextStart = i + 1 < starts.length ? starts[i + 1].bodyStart : source.length;
    const slice = source.slice(start.bodyStart, nextStart);
    const end = slice.lastIndexOf("endobj");
    const body = (end >= 0 ? slice.slice(0, end) : slice).trim();
    objects.set(start.id, { id: start.id, gen: start.gen, body });
  }
  return objects;
}

function findStreamBody(objectBody) {
  const match = String(objectBody || "").match(/([\s\S]*?)\bstream(?:\r\n|\n|\r)([\s\S]*?)endstream\b/);
  if (!match) return null;
  return { dict: match[1].trim(), dataLatin1: match[2].replace(/[\r\n]+$/, "") };
}


function decodeAscii85(buffer) {
  let source = buffer.toString("latin1")
    .replace(/\s+/g, "")
    .replace(/^<~/, "")
    .replace(/~>$/, "");
  const output = [];
  let group = [];
  for (const char of source) {
    if (char === "z" && group.length === 0) {
      output.push(0, 0, 0, 0);
      continue;
    }
    const code = char.charCodeAt(0);
    if (code < 33 || code > 117) continue;
    group.push(code - 33);
    if (group.length === 5) {
      let value = 0;
      for (const digit of group) value = value * 85 + digit;
      output.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
      group = [];
    }
  }
  if (group.length > 1) {
    const originalLength = group.length;
    while (group.length < 5) group.push(84);
    let value = 0;
    for (const digit of group) value = value * 85 + digit;
    const bytes = [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
    output.push(...bytes.slice(0, originalLength - 1));
  }
  return Buffer.from(output);
}

function decodeAsciiHex(buffer) {
  const hex = buffer.toString("latin1").replace(/[^0-9A-Fa-f]/g, "");
  const padded = hex.length % 2 ? `${hex}0` : hex;
  return Buffer.from(padded, "hex");
}

function decodeStream(objectBody) {
  const stream = findStreamBody(objectBody);
  if (!stream) return null;
  let data = Buffer.from(stream.dataLatin1, "latin1");
  if (data.length > MAX_STREAM_BYTES) {
    throw new Error("PDF có stream quá lớn để Reader xử lý an toàn.");
  }
  const filters = [];
  const arrayMatch = stream.dict.match(/\/Filter\s*\[([^\]]+)\]/s);
  if (arrayMatch) {
    for (const name of arrayMatch[1].matchAll(/\/([A-Za-z0-9]+)/g)) filters.push(name[1]);
  } else {
    const single = stream.dict.match(/\/Filter\s*\/([A-Za-z0-9]+)/);
    if (single) filters.push(single[1]);
  }
  for (const filter of filters) {
    if (filter === "FlateDecode" || filter === "Fl") {
      data = zlib.inflateSync(data);
    } else if (filter === "ASCIIHexDecode" || filter === "AHx") {
      data = decodeAsciiHex(data);
    } else if (filter === "ASCII85Decode" || filter === "A85") {
      data = decodeAscii85(data);
    } else {
      throw new Error(`PDF dùng filter ${filter} hiện chưa được Text Reader hỗ trợ.`);
    }
    if (data.length > MAX_STREAM_BYTES) {
      throw new Error("PDF stream giải nén vượt giới hạn an toàn.");
    }
  }
  return { dict: stream.dict, data };
}

function parseToUnicodeCMap(text) {
  const map = new Map();
  const source = String(text || "");
  for (const section of source.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of section[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      map.set(pair[1].toUpperCase(), decodeUtf16Be(Buffer.from(pair[2], "hex")));
    }
  }
  for (const section of source.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    const body = section[1];
    for (const range of body.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      const start = parseInt(range[1], 16);
      const end = parseInt(range[2], 16);
      const width = range[1].length;
      let target = parseInt(range[3], 16);
      for (let code = start; code <= end && code - start < 4096; code += 1, target += 1) {
        const sourceHex = code.toString(16).toUpperCase().padStart(width, "0");
        let targetHex = target.toString(16).toUpperCase();
        if (targetHex.length % 4) targetHex = targetHex.padStart(Math.ceil(targetHex.length / 4) * 4, "0");
        map.set(sourceHex, decodeUtf16Be(Buffer.from(targetHex, "hex")));
      }
    }
    for (const range of body.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([^\]]+)\]/g)) {
      const start = parseInt(range[1], 16);
      const width = range[1].length;
      const values = [...range[3].matchAll(/<([0-9A-Fa-f]+)>/g)].map((item) => item[1]);
      values.slice(0, 4096).forEach((value, index) => {
        map.set((start + index).toString(16).toUpperCase().padStart(width, "0"), decodeUtf16Be(Buffer.from(value, "hex")));
      });
    }
  }
  return map;
}

function buildFontUnicodeMaps(objects) {
  const mapsByObject = new Map();
  for (const object of objects.values()) {
    const toUnicode = object.body.match(/\/ToUnicode\s+(\d+)\s+\d+\s+R/);
    if (!toUnicode) continue;
    const cmapObject = objects.get(Number(toUnicode[1]));
    if (!cmapObject) continue;
    try {
      const stream = decodeStream(cmapObject.body);
      if (stream) mapsByObject.set(object.id, parseToUnicodeCMap(stream.data.toString("latin1")));
    } catch (_) {
      // A broken font map should not stop extraction from other fonts/pages.
    }
  }
  return mapsByObject;
}

function decodeWithFontMap(buffer, cmap) {
  if (cmap === DIRECT_UTF16BE) return decodeUtf16Be(buffer);
  if (!cmap || !cmap.size) return decodeSingleByte(buffer);
  const hex = buffer.toString("hex").toUpperCase();
  const lengths = [...new Set([...cmap.keys()].map((key) => key.length))].sort((a, b) => b - a);
  let result = "";
  let cursor = 0;
  while (cursor < hex.length) {
    let matched = false;
    for (const length of lengths) {
      const chunk = hex.slice(cursor, cursor + length);
      if (chunk.length === length && cmap.has(chunk)) {
        result += cmap.get(chunk);
        cursor += length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const byteHex = hex.slice(cursor, cursor + 2);
      result += decodeSingleByte(Buffer.from(byteHex, "hex"));
      cursor += 2;
    }
  }
  return result;
}

function tokenizeContentStream(source) {
  const tokens = [];
  const text = String(source || "");
  let i = 0;
  while (i < text.length) {
    if (/\s/.test(text[i])) { i += 1; continue; }
    if (text[i] === "%") { while (i < text.length && !/[\r\n]/.test(text[i])) i += 1; continue; }
    if (text[i] === "(") {
      const start = i;
      i += 1;
      let depth = 1;
      while (i < text.length && depth > 0) {
        if (text[i] === "\\") { i += 2; continue; }
        if (text[i] === "(") depth += 1;
        else if (text[i] === ")") depth -= 1;
        i += 1;
      }
      tokens.push(text.slice(start, i));
      continue;
    }
    if (text[i] === "<" && text[i + 1] !== "<") {
      const end = text.indexOf(">", i + 1);
      if (end < 0) break;
      tokens.push(text.slice(i, end + 1));
      i = end + 1;
      continue;
    }
    if (text[i] === "[") {
      const start = i;
      i += 1;
      let depth = 1;
      while (i < text.length && depth > 0) {
        if (text[i] === "(") {
          i += 1;
          let literalDepth = 1;
          while (i < text.length && literalDepth > 0) {
            if (text[i] === "\\") { i += 2; continue; }
            if (text[i] === "(") literalDepth += 1;
            else if (text[i] === ")") literalDepth -= 1;
            i += 1;
          }
          continue;
        }
        if (text[i] === "[") depth += 1;
        else if (text[i] === "]") depth -= 1;
        i += 1;
      }
      tokens.push(text.slice(start, i));
      continue;
    }
    let end = i + 1;
    while (end < text.length && !/\s/.test(text[end]) && !/[()<>\[\]]/.test(text[end])) end += 1;
    tokens.push(text.slice(i, end));
    i = end;
  }
  return tokens;
}

function parsePageFontResources(pageBody, objects, cmapByObject) {
  let resourcesText = pageBody;
  const resourceRef = pageBody.match(/\/Resources\s+(\d+)\s+\d+\s+R/);
  if (resourceRef && objects.get(Number(resourceRef[1]))) resourcesText += `\n${objects.get(Number(resourceRef[1])).body}`;
  const maps = new Map();
  let fontDictionary = "";
  const fontMatch = resourcesText.match(/\/Font\s*<<([\s\S]*?)>>/);
  if (fontMatch) {
    fontDictionary = fontMatch[1];
  } else {
    const fontRef = resourcesText.match(/\/Font\s+(\d+)\s+\d+\s+R/);
    if (fontRef && objects.get(Number(fontRef[1]))) {
      fontDictionary = objects.get(Number(fontRef[1])).body;
    }
  }
  if (!fontDictionary) return maps;
  for (const match of fontDictionary.matchAll(/\/([^\s/<>{}\[\]()]+)\s+(\d+)\s+\d+\s+R/g)) {
    const resourceName = decodePdfName(match[1]);
    const fontId = Number(match[2]);
    const fontObject = objects.get(fontId);
    const directUtf16 = fontObject && /\/Encoding\s*\/Uni(?:JIS|GB|CNS|KS)-UCS2-[HV]\b/.test(fontObject.body);
    maps.set(
      resourceName,
      cmapByObject.get(fontId) || (directUtf16 ? DIRECT_UTF16BE : null)
    );
  }
  return maps;
}

function parseArrayText(token, cmap) {
  const inner = String(token || "").slice(1, -1);
  const pieces = [];
  const partRegex = /(\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]+>|-?\d+(?:\.\d+)?)/g;
  let part;
  while ((part = partRegex.exec(inner))) {
    const value = part[1];
    if (value.startsWith("(")) pieces.push(decodeWithFontMap(decodePdfLiteralStringToken(value), cmap));
    else if (value.startsWith("<")) pieces.push(decodeWithFontMap(decodeHexToken(value), cmap));
    else if (Number(value) <= -160) pieces.push(" ");
  }
  return pieces.join("");
}

function extractTextFromContent(content, fontMaps) {
  const tokens = tokenizeContentStream(content);
  let inText = false;
  let currentFont = null;
  let pending = [];
  let output = "";
  const appendText = (value) => {
    const clean = String(value || "").replace(/\u0000/g, "");
    if (!clean) return;
    output += clean;
  };
  const newline = () => {
    if (!output.endsWith("\n")) output += "\n";
  };
  for (const token of tokens) {
    if (token === "BT") { inText = true; pending = []; continue; }
    if (token === "ET") { if (inText) newline(); inText = false; pending = []; continue; }
    if (!inText) continue;
    if (token === "Tf") {
      const fontToken = [...pending].reverse().find((value) => value.startsWith("/"));
      currentFont = fontToken ? decodePdfName(fontToken.slice(1)) : currentFont;
      pending = [];
      continue;
    }
    if (token === "Tj") {
      const value = pending[pending.length - 1];
      const cmap = fontMaps.get(currentFont) || null;
      if (value?.startsWith("(")) appendText(decodeWithFontMap(decodePdfLiteralStringToken(value), cmap));
      else if (value?.startsWith("<")) appendText(decodeWithFontMap(decodeHexToken(value), cmap));
      pending = [];
      continue;
    }
    if (token === "TJ") {
      const value = pending[pending.length - 1];
      appendText(parseArrayText(value, fontMaps.get(currentFont) || null));
      pending = [];
      continue;
    }
    if (token === "T*" || token === "'" || token === "\"") {
      newline();
      if (token === "'" || token === "\"") {
        const value = pending[pending.length - 1];
        const cmap = fontMaps.get(currentFont) || null;
        if (value?.startsWith("(")) appendText(decodeWithFontMap(decodePdfLiteralStringToken(value), cmap));
        else if (value?.startsWith("<")) appendText(decodeWithFontMap(decodeHexToken(value), cmap));
      }
      pending = [];
      continue;
    }
    if (token === "Td" || token === "TD") {
      const y = Number(pending[pending.length - 1]);
      if (Number.isFinite(y) && Math.abs(y) > 1) newline();
      pending = [];
      continue;
    }
    if (token === "Tm") {
      if (output && !output.endsWith("\n")) newline();
      pending = [];
      continue;
    }
    if (/^[A-Za-z*]+$/.test(token) && !token.startsWith("/")) {
      pending = [];
      continue;
    }
    pending.push(token);
    if (pending.length > 16) pending.shift();
  }
  return output
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseContentsRefs(pageBody) {
  const refs = [];
  const array = pageBody.match(/\/Contents\s*\[([\s\S]*?)\]/);
  if (array) {
    for (const match of array[1].matchAll(/(\d+)\s+\d+\s+R/g)) refs.push(Number(match[1]));
  } else {
    const single = pageBody.match(/\/Contents\s+(\d+)\s+\d+\s+R/);
    if (single) refs.push(Number(single[1]));
  }
  return refs;
}

function extractPages(objects) {
  return [...objects.values()]
    .filter((object) => /\/Type\s*\/Page\b/.test(object.body) && !/\/Type\s*\/Pages\b/.test(object.body))
    .sort((a, b) => a.id - b.id);
}

function normalizeRepeatedLine(value) {
  const clean = String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  if (/^(?:page|trang)\s+\d+(?:\s*[/\-]\s*\d+)?$/iu.test(clean) || /^\d+$/.test(clean)) {
    return clean.replace(/\d+/g, "#");
  }
  return clean;
}

function removeRepeatedHeadersFooters(pages) {
  if (pages.length < 3) return pages;
  const counts = new Map();
  for (const page of pages) {
    const lines = page.split("\n").map((line) => line.trim()).filter(Boolean);
    const candidates = [...lines.slice(0, 2), ...lines.slice(-2)];
    for (const line of new Set(candidates.map(normalizeRepeatedLine).filter((line) => line.length >= 3 && line.length <= 60))) {
      counts.set(line, (counts.get(line) || 0) + 1);
    }
  }
  const repeated = new Set([...counts.entries()].filter(([, count]) => count >= Math.ceil(pages.length * 0.6)).map(([line]) => line));
  if (!repeated.size) return pages;
  return pages.map((page) => {
    const lines = page.split("\n");
    return lines.filter((line, index) => {
      if (index > 1 && index < lines.length - 2) return true;
      return !repeated.has(normalizeRepeatedLine(line));
    }).join("\n");
  });
}

function isLikelyHeading(text) {
  const clean = String(text || "").trim();
  if (!clean || clean.length > 100) return false;
  return /^(?:第\s*[0-9０-９一二三四五六七八九十百千]+\s*[章話節巻部]|chapter\s+[0-9ivxlcdm]+|chương\s+[0-9ivxlcdm]+|prologue|epilogue|序章|終章|幕間|間章)/iu.test(clean);
}

function splitLongText(text, maxChars = 1100) {
  const clean = String(text || "").trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];
  const pieces = clean.match(/[^。！？!?]+[。！？!?]?/gu) || [clean];
  const result = [];
  let current = "";
  for (const piece of pieces) {
    const sentence = piece.trim();
    if (!sentence) continue;
    if (current && current.length + sentence.length + 1 > maxChars) {
      result.push(current.trim());
      current = "";
    }
    if (sentence.length > maxChars) {
      if (current) { result.push(current.trim()); current = ""; }
      for (let i = 0; i < sentence.length; i += maxChars) result.push(sentence.slice(i, i + maxChars));
    } else {
      current += `${current ? " " : ""}${sentence}`;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function pagesToBlocks(pages) {
  const blocks = [];
  let paragraph = [];
  const flush = () => {
    const text = paragraph.join(" ").replace(/\s+/g, " ").trim();
    paragraph = [];
    if (!text) return;
    for (const chunk of splitLongText(text)) blocks.push({ text: chunk, heading: false });
  };
  pages.forEach((pageText, pageIndex) => {
    const lines = String(pageText || "").split("\n").map((line) => line.replace(/\s+/g, " ").trim());
    for (const line of lines) {
      if (!line) { flush(); continue; }
      if (isLikelyHeading(line)) { flush(); blocks.push({ text: line, heading: true, pageNumber: pageIndex + 1 }); continue; }
      const previous = paragraph[paragraph.length - 1] || "";
      const previousEndsSentence = /[。！？.!?」』”’]$/.test(previous);
      if (paragraph.length && previousEndsSentence && (line.length < 70 || /^[A-ZÀ-Ỹ0-9第「『]/u.test(line))) flush();
      if (previous.endsWith("-") && /^[A-Za-zÀ-ỹ]/u.test(line)) paragraph[paragraph.length - 1] = previous.slice(0, -1) + line;
      else paragraph.push(line);
      if (paragraph.join(" ").length >= 1000) flush();
    }
    flush();
  });
  return blocks.map((block, index) => ({ id: `pdf-${index + 1}`, index, ...block }));
}

function extractInfoMetadata(objects) {
  let title = "";
  let author = "";
  for (const object of objects.values()) {
    if (!title) {
      const match = object.body.match(/\/Title\s*(\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]+>)/);
      if (match) title = decodeMetadataString(match[1]);
    }
    if (!author) {
      const match = object.body.match(/\/Author\s*(\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]+>)/);
      if (match) author = decodeMetadataString(match[1]);
    }
  }
  return { title, author };
}

function decodeMetadataString(token) {
  const buffer = token.startsWith("(") ? decodePdfLiteralStringToken(token) : decodeHexToken(token);
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) return decodeUtf16Be(buffer);
  return decodeSingleByte(buffer).trim();
}

function parsePdfTextBuffer(buffer, fileName = "document.pdf") {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8 || buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("File không phải PDF hợp lệ.");
  }
  if (buffer.length > MAX_PDF_BYTES) throw new Error("PDF lớn hơn 100 MB. Hãy dùng file nhẹ hơn.");
  const raw = buffer.toString("latin1");
  if (/\/Encrypt\b/.test(raw)) throw new Error("PDF được mã hóa/password hiện chưa được Reader hỗ trợ.");
  const objects = parseIndirectObjects(buffer);
  if (!objects.size) throw new Error("Không đọc được cấu trúc object của PDF này.");
  if ([...objects.values()].some((object) => /\/Type\s*\/ObjStm\b/.test(object.body))) {
    // Continue when page objects are still visible; otherwise report a precise limitation below.
  }
  const cmapByObject = buildFontUnicodeMaps(objects);
  const pageObjects = extractPages(objects);
  if (!pageObjects.length) throw new Error("PDF dùng cấu trúc page/object stream hiện chưa được Text Reader hỗ trợ.");
  const pages = [];
  for (const page of pageObjects.slice(0, 2500)) {
    const fonts = parsePageFontResources(page.body, objects, cmapByObject);
    let pageText = "";
    for (const contentId of parseContentsRefs(page.body)) {
      const object = objects.get(contentId);
      if (!object) continue;
      try {
        const stream = decodeStream(object.body);
        if (stream) pageText += `${extractTextFromContent(stream.data.toString("latin1"), fonts)}\n`;
      } catch (error) {
        if (/filter/i.test(String(error?.message || ""))) throw error;
      }
    }
    pages.push(pageText.trim());
  }
  const cleanedPages = removeRepeatedHeadersFooters(pages);
  const characterCount = cleanedPages.join("").replace(/\s/g, "").length;
  if (characterCount < 20) {
    throw new Error("PDF gần như không có text extract được. File có thể là PDF scan/ảnh; hãy dùng PDF OCR Reader ở Batch 14.3.");
  }
  const blocks = pagesToBlocks(cleanedPages);
  const chapters = blocks.filter((block) => block.heading).map((block) => ({ label: block.text, index: block.index, pageNumber: block.pageNumber }));
  const metadata = extractInfoMetadata(objects);
  return {
    metadata: {
      title: metadata.title || String(fileName || "").replace(/\.pdf$/i, ""),
      author: metadata.author || "",
      language: "",
      pageCount: pages.length,
      textCharacterCount: characterCount,
    },
    blocks,
    chapters,
    pages: cleanedPages,
  };
}

module.exports = {
  parsePdfTextBuffer,
  parseToUnicodeCMap,
  extractTextFromContent,
  pagesToBlocks,
};
