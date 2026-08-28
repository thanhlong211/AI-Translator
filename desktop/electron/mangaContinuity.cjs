"use strict";

const DEFAULT_MAX_TERMS = 32;
const DEFAULT_CONTEXT_MAX_CHARS = 1750;

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function compactText(
  value,
  maxChars = DEFAULT_CONTEXT_MAX_CHARS
) {
  const text = normalizeText(value);

  const limit = Math.max(
    200,
    Math.min(
      1950,
      Number(maxChars) ||
        DEFAULT_CONTEXT_MAX_CHARS
    )
  );

  if (text.length <= limit) {
    return text;
  }

  const separator = "\n…\n";
  const usable = Math.max(
    0,
    limit - separator.length
  );

  const headLength = Math.floor(
    usable * 0.35
  );

  const tailLength =
    usable - headLength;

  return (
    text.slice(0, headLength) +
    separator +
    text.slice(-tailLength)
  );
}

function createEmptyMangaContinuityState() {
  return {
    version: 1,
    terms: [],
    updatedAt: null,
  };
}

function isMangaContinuityCandidate(
  original,
  translatedText
) {
  const source =
    normalizeText(original);

  const target =
    normalizeText(translatedText);

  if (
    !source ||
    !target ||
    source.length > 32 ||
    target.length > 80
  ) {
    return false;
  }

  if (
    source.includes("\n") ||
    target.includes("\n")
  ) {
    return false;
  }

  /*
   * Conservative Phase 1:
   * Hiragana generally indicates dialogue /
   * grammatical content rather than a stable
   * character or terminology mapping.
   */
  if (
    /[\u3040-\u309f]/u.test(source)
  ) {
    return false;
  }

  if (
    /[。！？!?…]/u.test(source)
  ) {
    return false;
  }

  const words =
    source
      .split(/\s+/u)
      .filter(Boolean);

  if (words.length > 4) {
    return false;
  }

  return true;
}

function upsertMangaContinuityTerm(
  terms,
  {
    original,
    translatedText,
    chapterNumber = 1,
    pageNumber = 1,
    updatedAt = Date.now(),
  } = {},
  maxTerms = DEFAULT_MAX_TERMS
) {
  const source =
    normalizeText(original);

  const target =
    normalizeText(translatedText);

  if (
    !isMangaContinuityCandidate(
      source,
      target
    )
  ) {
    return Array.isArray(terms)
      ? terms.map((term) => ({
          ...term,
        }))
      : [];
  }

  const safeLimit = Math.max(
    1,
    Number(maxTerms) ||
      DEFAULT_MAX_TERMS
  );

  const next =
    (Array.isArray(terms)
      ? terms
      : []
    )
      .filter(
        (term) =>
          normalizeText(
            term?.original
          ) !== source
      )
      .map((term) => ({
        ...term,
      }));

  next.push({
    original: source,
    translatedText: target,
    vietnamese: target,
    evidence:
      "USER_CORRECTION",

    chapterNumber:
      Math.max(
        1,
        Number(chapterNumber) || 1
      ),

    pageNumber:
      Math.max(
        1,
        Number(pageNumber) || 1
      ),

    updatedAt:
      Number(updatedAt) ||
      Date.now(),
  });

  return next.slice(-safeLimit);
}

function buildMangaContinuityContextItem(
  terms,
  {
    maxChars =
      DEFAULT_CONTEXT_MAX_CHARS,
    maxTerms =
      DEFAULT_MAX_TERMS,
  } = {}
) {
  const normalized =
    (Array.isArray(terms)
      ? terms
      : []
    )
      .map((term) => ({
        original:
          normalizeText(
            term?.original
          ),

        translatedText:
          normalizeText(
            term?.translatedText ||
            term?.vietnamese
          ),
      }))
      .filter(
        (term) =>
          term.original &&
          term.translatedText
      )
      .slice(-maxTerms);

  if (!normalized.length) {
    return null;
  }

  const originalLines = [
    "[MANGA_CONTINUITY USER_CONFIRMED]",
  ];

  const translatedLines = [
    "[MANGA_CONTINUITY USER_CONFIRMED]",
  ];

  normalized.forEach(
    (term, index) => {
      const number = index + 1;

      originalLines.push(
        `${number}. ${term.original}`
      );

      translatedLines.push(
        `${number}. ${term.translatedText}`
      );
    }
  );

  const original =
    compactText(
      originalLines.join("\n"),
      maxChars
    );

  const translatedText =
    compactText(
      translatedLines.join("\n"),
      maxChars
    );

  return {
    scope: "CONTINUITY",
    blockCount:
      normalized.length,
    original,
    translatedText,
    vietnamese:
      translatedText,
  };
}

function mergeMangaTranslationContext(
  recentContext,
  continuityItem,
  contextLimit
) {
  const limit =
    Math.max(
      0,
      Number(contextLimit) || 0
    );

  if (limit <= 0) {
    return [];
  }

  const recent =
    Array.isArray(recentContext)
      ? recentContext
      : [];

  const merged =
    continuityItem
      ? [
          ...recent,
          continuityItem,
        ]
      : [...recent];

  return merged.slice(-limit);
}

module.exports = {
  DEFAULT_MAX_TERMS,
  DEFAULT_CONTEXT_MAX_CHARS,
  createEmptyMangaContinuityState,
  isMangaContinuityCandidate,
  upsertMangaContinuityTerm,
  buildMangaContinuityContextItem,
  mergeMangaTranslationContext,
};
