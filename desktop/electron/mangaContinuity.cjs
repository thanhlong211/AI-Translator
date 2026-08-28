"use strict";

const DEFAULT_MAX_TERMS = 32;
const DEFAULT_CONTEXT_MAX_CHARS = 1750;

/*
 * Patch 8.1
 *
 * Auto continuity is intentionally conservative:
 * the same exact mapping must appear on at least two
 * different Manga pages before it may be promoted.
 */
const DEFAULT_AUTO_THRESHOLD = 2;
const DEFAULT_MAX_OBSERVATIONS = 64;

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
    observations: [],
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
    evidence = "USER_CORRECTION",
    seenCount = null,
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
      evidence === "AUTO_REPEATED"
        ? "AUTO_REPEATED"
        : "USER_CORRECTION",

    ...(
      Number(seenCount) > 0
        ? {
            seenCount:
              Number(seenCount),
          }
        : {}
    ),

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


function observeMangaContinuityCandidate(
  continuityState,
  {
    original,
    translatedText,
    chapterNumber = 1,
    pageNumber = 1,
    updatedAt = Date.now(),
  } = {},
  {
    threshold =
      DEFAULT_AUTO_THRESHOLD,
    maxObservations =
      DEFAULT_MAX_OBSERVATIONS,
    maxTerms =
      DEFAULT_MAX_TERMS,
  } = {}
) {
  const state = {
    version:
      Number(
        continuityState?.version
      ) || 1,

    terms:
      Array.isArray(
        continuityState?.terms
      )
        ? continuityState.terms.map(
            (term) => ({
              ...term,
            })
          )
        : [],

    observations:
      Array.isArray(
        continuityState?.observations
      )
        ? continuityState
            .observations
            .map(
              (item) => ({
                ...item,
                seenPages:
                  Array.isArray(
                    item?.seenPages
                  )
                    ? [
                        ...item
                          .seenPages,
                      ]
                    : [],
              })
            )
        : [],

    updatedAt:
      continuityState?.updatedAt ??
      null,
  };

  const source =
    normalizeText(original);

  const target =
    normalizeText(
      translatedText
    );

  if (
    !isMangaContinuityCandidate(
      source,
      target
    )
  ) {
    return {
      state,
      promoted: null,
      reason:
        "NOT_CANDIDATE",
    };
  }

  const existingTerm =
    state.terms.find(
      (term) =>
        normalizeText(
          term?.original
        ) === source
    );

  /*
   * Stable continuity must never be silently rewritten by
   * automatic observations. This is especially important for
   * USER_CORRECTION evidence.
   */
  if (existingTerm) {
    return {
      state,
      promoted: null,
      reason:
        existingTerm.evidence ===
        "USER_CORRECTION"
          ? "USER_CONFIRMED_EXISTS"
          : "TERM_ALREADY_EXISTS",
    };
  }

  const safeChapter =
    Math.max(
      1,
      Number(chapterNumber) || 1
    );

  const safePage =
    Math.max(
      1,
      Number(pageNumber) || 1
    );

  const pageKey =
    `${safeChapter}:${safePage}`;

  const now =
    Number(updatedAt) ||
    Date.now();

  const observationIndex =
    state.observations
      .findIndex(
        (item) =>
          normalizeText(
            item?.original
          ) === source
      );

  let observation;

  if (observationIndex < 0) {
    observation = {
      original:
        source,

      translatedText:
        target,

      seenPages:
        [pageKey],

      seenCount:
        1,

      conflicting:
        false,

      firstSeenChapter:
        safeChapter,

      firstSeenPage:
        safePage,

      lastSeenChapter:
        safeChapter,

      lastSeenPage:
        safePage,

      updatedAt:
        now,
    };

    state.observations.push(
      observation
    );
  } else {
    observation =
      state.observations[
        observationIndex
      ];

    /*
     * One conflicting AI translation is enough to prevent
     * automatic promotion for this source in the current
     * Manga Session.
     */
    if (
      normalizeText(
        observation
          ?.translatedText
      ) !== target
    ) {
      observation = {
        ...observation,

        conflicting:
          true,

        lastConflictingTranslation:
          target,

        lastSeenChapter:
          safeChapter,

        lastSeenPage:
          safePage,

        updatedAt:
          now,
      };

      state.observations[
        observationIndex
      ] = observation;

      state.updatedAt =
        now;

      return {
        state,
        promoted: null,
        reason:
          "CONFLICT",
      };
    }

    const seenPages =
      Array.from(
        new Set([
          ...(
            Array.isArray(
              observation
                ?.seenPages
            )
              ? observation
                  .seenPages
              : []
          ),
          pageKey,
        ])
      );

    observation = {
      ...observation,

      seenPages,

      seenCount:
        seenPages.length,

      lastSeenChapter:
        safeChapter,

      lastSeenPage:
        safePage,

      updatedAt:
        now,
    };

    state.observations[
      observationIndex
    ] = observation;
  }

  state.observations =
    state.observations.slice(
      -Math.max(
        1,
        Number(
          maxObservations
        ) ||
        DEFAULT_MAX_OBSERVATIONS
      )
    );

  state.updatedAt =
    now;

  const required =
    Math.max(
      2,
      Number(threshold) ||
      DEFAULT_AUTO_THRESHOLD
    );

  if (
    observation.conflicting ||
    Number(
      observation.seenCount
    ) < required
  ) {
    return {
      state,
      promoted: null,
      reason:
        "OBSERVED",
    };
  }

  const terms =
    upsertMangaContinuityTerm(
      state.terms,
      {
        original:
          source,

        translatedText:
          target,

        chapterNumber:
          safeChapter,

        pageNumber:
          safePage,

        updatedAt:
          now,

        evidence:
          "AUTO_REPEATED",

        seenCount:
          observation
            .seenCount,
      },
      maxTerms
    );

  const promoted =
    terms.find(
      (term) =>
        normalizeText(
          term?.original
        ) === source
    ) || null;

  state.terms =
    terms;

  /*
   * Once promoted, the temporary observation is no longer
   * needed. The stable term contains its evidence and count.
   */
  state.observations =
    state.observations.filter(
      (item) =>
        normalizeText(
          item?.original
        ) !== source
    );

  return {
    state,
    promoted,
    reason:
      "PROMOTED",
  };
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
  DEFAULT_AUTO_THRESHOLD,
  DEFAULT_MAX_OBSERVATIONS,
  createEmptyMangaContinuityState,
  isMangaContinuityCandidate,
  upsertMangaContinuityTerm,
  observeMangaContinuityCandidate,
  buildMangaContinuityContextItem,
  mergeMangaTranslationContext,
};
