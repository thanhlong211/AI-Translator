const zlib = require("zlib");
const sharp = require("sharp");

const MAX_PDF_BYTES = 120 * 1024 * 1024;
const MAX_IMAGE_STREAM_BYTES = 48 * 1024 * 1024;
const MAX_DECODED_IMAGE_BYTES = 96 * 1024 * 1024;

function decodePdfLiteralStringToken(token) {
  const raw = String(token || "");
  if (!raw.startsWith("(") || !raw.endsWith(")")) return "";
  const body = raw.slice(1, -1);
  const bytes = [];
  for (let i = 0; i < body.length; i += 1) {
    const code = body.charCodeAt(i) & 0xff;
    if (code !== 0x5c) {
      bytes.push(code);
      continue;
    }
    if (i + 1 >= body.length) break;
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
    if (next === "\n") continue;
    if (next === "\r") {
      if (body[i + 1] === "\n") i += 1;
      continue;
    }
    bytes.push(next.charCodeAt(0) & 0xff);
  }
  return Buffer.from(bytes).toString("utf8").trim();
}

function decodeMetadataString(token) {
  if (!token) return "";
  if (token.startsWith("(")) return decodePdfLiteralStringToken(token);
  const hex = token.replace(/[<>\s]/g, "");
  if (!hex) return "";
  const bytes = Buffer.from(hex.length % 2 ? `${hex}0` : hex, "hex");
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const swapped = Buffer.from(bytes.subarray(2));
    for (let i = 0; i + 1 < swapped.length; i += 2) {
      const temp = swapped[i];
      swapped[i] = swapped[i + 1];
      swapped[i + 1] = temp;
    }
    return swapped.toString("utf16le").trim();
  }
  return bytes.toString("utf8").trim();
}

function parseIndirectObjects(buffer) {
  const source = buffer.toString("latin1");
  const objects = new Map();
  const regex = /(^|[\r\n])\s*(\d+)\s+(\d+)\s+obj\b/gm;
  const starts = [];
  let match;
  while ((match = regex.exec(source))) {
    starts.push({
      id: Number(match[2]),
      gen: Number(match[3]),
      bodyStart: regex.lastIndex,
    });
  }
  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i];
    const nextStart = i + 1 < starts.length ? starts[i + 1].bodyStart : source.length;
    const slice = source.slice(start.bodyStart, nextStart);
    const end = slice.lastIndexOf("endobj");
    const body = (end >= 0 ? slice.slice(0, end) : slice).trim();
    objects.set(start.id, {
      id: start.id,
      gen: start.gen,
      body,
    });
  }
  return objects;
}

function findStreamBody(objectBody) {
  const match = String(objectBody || "").match(/([\s\S]*?)\bstream(?:\r\n|\n|\r)([\s\S]*?)endstream\b/);
  if (!match) return null;
  return {
    dict: match[1].trim(),
    data: Buffer.from(match[2].replace(/[\r\n]+$/, ""), "latin1"),
  };
}

function filterNames(dict) {
  const names = [];
  const array = String(dict || "").match(/\/Filter\s*\[([^\]]+)\]/s);
  if (array) {
    for (const match of array[1].matchAll(/\/([A-Za-z0-9]+)/g)) names.push(match[1]);
    return names;
  }
  const single = String(dict || "").match(/\/Filter\s*\/([A-Za-z0-9]+)/);
  if (single) names.push(single[1]);
  return names;
}

function decodeAscii85(buffer) {
  const source = buffer.toString("latin1")
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
  return Buffer.from(hex.length % 2 ? `${hex}0` : hex, "hex");
}

function numberFromDict(dict, key, fallback = 0) {
  const match = String(dict || "").match(new RegExp(`/${key}\\s+([0-9.]+)`));
  return match ? Number(match[1]) : fallback;
}

function nameFromDict(dict, key) {
  const match = String(dict || "").match(new RegExp(`/${key}\\s*/([^\\s/<>{}\\[\\]()]*)`));
  return match ? match[1] : "";
}

function extractPages(objects) {
  return [...objects.values()]
    .filter((object) => /\/Type\s*\/Page\b/.test(object.body) && !/\/Type\s*\/Pages\b/.test(object.body))
    .sort((a, b) => a.id - b.id);
}

function resolveInheritedBody(page, objects) {
  let combined = page.body;
  let current = page;
  const visited = new Set([page.id]);
  for (let depth = 0; depth < 8; depth += 1) {
    if (/\/Resources\b/.test(combined) && /\/MediaBox\b/.test(combined)) break;
    const parent = current.body.match(/\/Parent\s+(\d+)\s+\d+\s+R/);
    if (!parent) break;
    const id = Number(parent[1]);
    if (visited.has(id)) break;
    visited.add(id);
    current = objects.get(id);
    if (!current) break;
    combined += `\n${current.body}`;
  }
  return combined;
}

function resolveResourcesBody(page, objects) {
  const inherited = resolveInheritedBody(page, objects);

  // Keep the full inherited page/resources body. A PDF resource dictionary often
  // contains nested dictionaries such as:
  //   /Resources << /XObject << /Im0 4 0 R >> >>
  // Trying to capture /Resources <<...>> with a non-greedy regex truncates the
  // body at the inner XObject terminator. Searching /XObject on the full body
  // avoids that ambiguity and also keeps inherited resources available.
  const ref = inherited.match(/\/Resources\s+(\d+)\s+\d+\s+R/);
  if (ref && objects.get(Number(ref[1]))) {
    return `${inherited}\n${objects.get(Number(ref[1])).body}`;
  }

  return inherited;
}

function resolveXObjectDictionary(resourcesBody, objects) {
  const direct = String(resourcesBody || "").match(/\/XObject\s*<<([\s\S]*?)>>/);
  if (direct) return direct[1];
  const ref = String(resourcesBody || "").match(/\/XObject\s+(\d+)\s+\d+\s+R/);
  if (ref && objects.get(Number(ref[1]))) return objects.get(Number(ref[1])).body;
  return "";
}

function imageCandidatesForPage(page, objects) {
  const resourcesBody = resolveResourcesBody(page, objects);
  const xObjects = resolveXObjectDictionary(resourcesBody, objects);
  const candidates = [];
  const seen = new Set();
  for (const match of xObjects.matchAll(/\/([^\s/<>{}\[\]()]+)\s+(\d+)\s+\d+\s+R/g)) {
    const id = Number(match[2]);
    if (seen.has(id)) continue;
    seen.add(id);
    const object = objects.get(id);
    if (!object || !/\/Subtype\s*\/Image\b/.test(object.body)) continue;
    const stream = findStreamBody(object.body);
    if (!stream) continue;
    const width = numberFromDict(stream.dict, "Width");
    const height = numberFromDict(stream.dict, "Height");
    const bits = numberFromDict(stream.dict, "BitsPerComponent", 8);
    const colorSpace = nameFromDict(stream.dict, "ColorSpace") || "DeviceGray";
    const filters = filterNames(stream.dict);
    candidates.push({
      name: match[1],
      id,
      width,
      height,
      bits,
      colorSpace,
      filters,
      dict: stream.dict,
      data: stream.data,
      area: width * height,
    });
  }
  candidates.sort((a, b) => b.area - a.area);
  return candidates;
}

function applyPngPredictor(data, columns, colors, bits, predictor) {
  if (!predictor || predictor < 10 || predictor > 15) return data;
  if (bits !== 8) throw new Error("PDF OCR chưa hỗ trợ PNG predictor với BitsPerComponent khác 8.");
  const bytesPerPixel = Math.max(1, colors);
  const rowBytes = Math.ceil(columns * colors * bits / 8);
  const output = Buffer.alloc(Math.floor(data.length / (rowBytes + 1)) * rowBytes);
  let sourceOffset = 0;
  let targetOffset = 0;
  let previous = Buffer.alloc(rowBytes);
  while (sourceOffset + rowBytes + 1 <= data.length) {
    const filter = data[sourceOffset++];
    const row = Buffer.from(data.subarray(sourceOffset, sourceOffset + rowBytes));
    sourceOffset += rowBytes;
    for (let i = 0; i < row.length; i += 1) {
      const left = i >= bytesPerPixel ? row[i - bytesPerPixel] : 0;
      const up = previous[i] || 0;
      const upLeft = i >= bytesPerPixel ? previous[i - bytesPerPixel] : 0;
      if (filter === 1) row[i] = (row[i] + left) & 0xff;
      else if (filter === 2) row[i] = (row[i] + up) & 0xff;
      else if (filter === 3) row[i] = (row[i] + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        const predict = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        row[i] = (row[i] + predict) & 0xff;
      } else if (filter !== 0) {
        throw new Error(`PDF OCR gặp PNG predictor filter ${filter} chưa hỗ trợ.`);
      }
    }
    row.copy(output, targetOffset);
    targetOffset += rowBytes;
    previous = row;
  }
  return output.subarray(0, targetOffset);
}

function expandOneBitGray(data, width, height) {
  const rowBytes = Math.ceil(width / 8);
  const output = Buffer.alloc(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const byte = data[y * rowBytes + Math.floor(x / 8)] || 0;
      const bit = (byte >> (7 - (x % 8))) & 1;
      output[y * width + x] = bit ? 255 : 0;
    }
  }
  return output;
}

function cmykToRgb(data) {
  const pixels = Math.floor(data.length / 4);
  const output = Buffer.alloc(pixels * 3);
  for (let i = 0; i < pixels; i += 1) {
    const c = data[i * 4] / 255;
    const m = data[i * 4 + 1] / 255;
    const y = data[i * 4 + 2] / 255;
    const k = data[i * 4 + 3] / 255;
    output[i * 3] = Math.round(255 * (1 - c) * (1 - k));
    output[i * 3 + 1] = Math.round(255 * (1 - m) * (1 - k));
    output[i * 3 + 2] = Math.round(255 * (1 - y) * (1 - k));
  }
  return output;
}

function parseDecodeParms(dict, width, colorCount, bits) {
  const predictor = numberFromDict(dict, "Predictor", 1);
  const columns = numberFromDict(dict, "Columns", width) || width;
  const colors = numberFromDict(dict, "Colors", colorCount) || colorCount;
  const decodeBits = numberFromDict(dict, "BitsPerComponent", bits) || bits;
  return { predictor, columns, colors, bits: decodeBits };
}

async function candidateToPng(candidate) {
  if (!candidate.width || !candidate.height) throw new Error("PDF image thiếu Width/Height.");
  if (candidate.data.length > MAX_IMAGE_STREAM_BYTES) throw new Error("PDF image stream vượt giới hạn an toàn.");

  let data = candidate.data;
  const filters = [...candidate.filters];
  while (filters.length && ["ASCII85Decode", "A85", "ASCIIHexDecode", "AHx"].includes(filters[0])) {
    const filter = filters.shift();
    data = filter === "ASCII85Decode" || filter === "A85" ? decodeAscii85(data) : decodeAsciiHex(data);
  }

  if (filters.length === 1 && ["DCTDecode", "DCT", "JPXDecode"].includes(filters[0])) {
    return sharp(data, { failOn: "none" })
      .rotate()
      .png()
      .toBuffer();
  }

  if (filters.length === 1 && ["FlateDecode", "Fl"].includes(filters[0])) {
    data = zlib.inflateSync(data);
    const colorSpace = candidate.colorSpace;
    let channels = colorSpace === "DeviceRGB" ? 3 : colorSpace === "DeviceCMYK" ? 4 : 1;
    const parms = parseDecodeParms(candidate.dict, candidate.width, channels, candidate.bits);
    data = applyPngPredictor(data, parms.columns, parms.colors, parms.bits, parms.predictor);
    if (data.length > MAX_DECODED_IMAGE_BYTES) throw new Error("PDF image giải nén vượt giới hạn an toàn.");
    if (candidate.bits === 1 && channels === 1) data = expandOneBitGray(data, candidate.width, candidate.height);
    else if (candidate.bits !== 8) throw new Error(`PDF OCR chưa hỗ trợ image ${candidate.bits}-bit.`);
    if (channels === 4) {
      data = cmykToRgb(data);
      channels = 3;
    }
    const needed = candidate.width * candidate.height * channels;
    if (data.length < needed) throw new Error("PDF image Flate bị thiếu dữ liệu pixel.");
    return sharp(data.subarray(0, needed), {
      raw: {
        width: candidate.width,
        height: candidate.height,
        channels,
      },
    }).png().toBuffer();
  }

  const label = filters.length ? filters.join("+") : "raw/unknown";
  throw new Error(`PDF scan dùng image filter ${label} hiện chưa được OCR Reader hỗ trợ.`);
}

function extractInfoMetadata(objects, fileName) {
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
  return {
    title: title || String(fileName || "document.pdf").replace(/\.pdf$/i, ""),
    author,
  };
}

function inspectPdfOcrBuffer(buffer, fileName = "document.pdf") {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8 || buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("File không phải PDF hợp lệ.");
  }
  if (buffer.length > MAX_PDF_BYTES) throw new Error("PDF OCR lớn hơn 120 MB. Hãy dùng file nhẹ hơn.");
  const raw = buffer.toString("latin1");
  if (/\/Encrypt\b/.test(raw)) throw new Error("PDF password/encrypted hiện chưa được PDF OCR Reader hỗ trợ.");
  const objects = parseIndirectObjects(buffer);
  if (!objects.size) throw new Error("Không đọc được cấu trúc object của PDF scan.");
  const pages = extractPages(objects);
  if (!pages.length) throw new Error("PDF dùng page/object stream mà PDF OCR Reader v1 chưa hỗ trợ.");
  const metadata = extractInfoMetadata(objects, fileName);
  let imagePages = 0;
  const filters = new Set();
  for (const page of pages.slice(0, 40)) {
    const candidates = imageCandidatesForPage(page, objects);
    if (candidates.length) imagePages += 1;
    for (const candidate of candidates.slice(0, 2)) {
      for (const filter of candidate.filters) filters.add(filter);
    }
  }
  if (!imagePages) {
    throw new Error("PDF không có image page phù hợp để OCR. Nếu đây là PDF có text, hãy mở bằng + PDF Text.");
  }
  return {
    pageCount: pages.length,
    sampledImagePages: imagePages,
    sampledPages: Math.min(40, pages.length),
    filters: [...filters],
    title: metadata.title,
    author: metadata.author,
    language: "",
  };
}

async function extractPdfPagePng(buffer, pageNumber) {
  const objects = parseIndirectObjects(buffer);
  const pages = extractPages(objects);
  const pageIndex = Math.max(0, Number(pageNumber) - 1);
  const page = pages[pageIndex];
  if (!page) throw new Error(`PDF không có trang ${pageNumber}.`);
  const candidates = imageCandidatesForPage(page, objects)
    .filter((candidate) => candidate.width >= 320 && candidate.height >= 320);
  if (!candidates.length) {
    throw new Error(`Trang ${pageNumber} không có image scan đủ lớn để OCR.`);
  }
  const errors = [];
  for (const candidate of candidates.slice(0, 5)) {
    try {
      const png = await candidateToPng(candidate);
      const metadata = await sharp(png).metadata();
      return {
        png,
        width: metadata.width || candidate.width,
        height: metadata.height || candidate.height,
        imageObjectId: candidate.id,
        filters: candidate.filters,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(errors[0] || `Không decode được image scan của trang ${pageNumber}.`);
}

function median(values, fallback = 16) {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!clean.length) return fallback;
  return clean[Math.floor(clean.length / 2)];
}

function containsCjk(text) {
  return /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(String(text || ""));
}

function smartJoin(left, right) {
  if (!left) return right;
  if (!right) return left;
  const noSpace = /[\u3040-\u30ff\u3400-\u9fff]$/u.test(left) || /^[\u3040-\u30ff\u3400-\u9fff、。！？）」』]/u.test(right);
  return `${left}${noSpace ? "" : " "}${right}`;
}

function splitOcrText(text, maxChars = 950) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];
  const pieces = clean.match(/[^。！？.!?]+[。！？.!?]?/gu) || [clean];
  const output = [];
  let current = "";
  for (let piece of pieces) {
    piece = piece.trim();
    if (!piece) continue;
    if (current && current.length + piece.length > maxChars) {
      output.push(current.trim());
      current = "";
    }
    if (piece.length > maxChars) {
      if (current) output.push(current.trim());
      current = "";
      for (let i = 0; i < piece.length; i += maxChars) output.push(piece.slice(i, i + maxChars));
    } else {
      current = smartJoin(current, piece);
    }
  }
  if (current.trim()) output.push(current.trim());
  return output;
}

function ocrResultToPageBlocks(ocrResult, pageNumber, imageWidth = 0, imageHeight = 0) {
  const lines = Array.isArray(ocrResult?.lines) ? ocrResult.lines : [];
  const scores = Array.isArray(ocrResult?.scores) ? ocrResult.scores : [];
  const boxes = Array.isArray(ocrResult?.boxes) ? ocrResult.boxes : [];
  const entries = [];
  for (let i = 0; i < lines.length; i += 1) {
    const text = String(lines[i] || "").trim();
    const score = Number(scores[i] || 0);
    const box = boxes[i] || {};
    const x = Number(box.x || 0);
    const y = Number(box.y || 0);
    const width = Number(box.width || 0);
    const height = Number(box.height || 0);
    if (!text || score < 0.45 || width <= 0 || height <= 0) continue;
    const numericPageNoise = /^[\s\-–—]*[0-9０-９]{1,4}[\s\-–—]*$/u.test(text) && imageHeight > 0 && (y < imageHeight * 0.08 || y + height > imageHeight * 0.92);
    if (numericPageNoise) continue;
    entries.push({ text, score, x, y, width, height, right: x + width, bottom: y + height });
  }
  if (!entries.length) return [];
  const medianWidth = median(entries.map((entry) => entry.width), 40);
  const medianHeight = median(entries.map((entry) => entry.height), 24);
  const verticalVotes = entries.filter((entry) => entry.height > entry.width * 1.35 && containsCjk(entry.text)).length;
  const vertical = verticalVotes >= Math.max(2, Math.ceil(entries.length * 0.35));
  const paragraphs = [];

  if (vertical) {
    const columns = [];
    for (const entry of [...entries].sort((a, b) => b.x - a.x || a.y - b.y)) {
      const centerX = entry.x + entry.width / 2;
      let column = columns.find((item) => Math.abs(item.centerX - centerX) <= Math.max(18, medianWidth * 0.9));
      if (!column) {
        column = { centerX, items: [] };
        columns.push(column);
      }
      column.items.push(entry);
    }
    columns.sort((a, b) => b.centerX - a.centerX);
    for (const column of columns) {
      const ordered = column.items.sort((a, b) => a.y - b.y);
      let text = "";
      for (const entry of ordered) text = smartJoin(text, entry.text);
      if (text.trim()) paragraphs.push(text.trim());
    }
  } else {
    const ordered = [...entries].sort((a, b) => {
      const tolerance = Math.max(8, medianHeight * 0.55);
      if (Math.abs(a.y - b.y) <= tolerance) return a.x - b.x;
      return a.y - b.y;
    });
    const rows = [];
    for (const entry of ordered) {
      const centerY = entry.y + entry.height / 2;
      let row = rows.find((item) => Math.abs(item.centerY - centerY) <= Math.max(8, medianHeight * 0.55));
      if (!row) {
        row = { centerY, top: entry.y, bottom: entry.bottom, items: [] };
        rows.push(row);
      }
      row.items.push(entry);
      row.top = Math.min(row.top, entry.y);
      row.bottom = Math.max(row.bottom, entry.bottom);
    }
    rows.sort((a, b) => a.top - b.top);
    let paragraph = "";
    let previousBottom = null;
    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x);
      let rowText = "";
      for (const entry of row.items) rowText = smartJoin(rowText, entry.text);
      const gap = previousBottom == null ? 0 : row.top - previousBottom;
      const startsIndented = row.items[0]?.x > Math.max(16, medianWidth * 0.75);
      const previousEnds = /[。！？.!?」』”’]$/u.test(paragraph);
      if (paragraph && (gap > medianHeight * 1.45 || (startsIndented && previousEnds) || paragraph.length > 850)) {
        paragraphs.push(paragraph.trim());
        paragraph = "";
      }
      paragraph = smartJoin(paragraph, rowText);
      previousBottom = row.bottom;
    }
    if (paragraph.trim()) paragraphs.push(paragraph.trim());
  }

  const blocks = [];
  let local = 0;
  for (const paragraph of paragraphs) {
    for (const chunk of splitOcrText(paragraph)) {
      blocks.push({
        id: `pdf-ocr-p${pageNumber}-b${++local}`,
        index: 0,
        text: chunk,
        heading: false,
        pageNumber: Number(pageNumber),
        sourcePath: `page:${pageNumber}`,
        ocrSource: true,
      });
    }
  }
  return blocks;
}

module.exports = {
  inspectPdfOcrBuffer,
  extractPdfPagePng,
  ocrResultToPageBlocks,
};
