"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const {
  createEmptyMangaContinuityState,
  isMangaContinuityCandidate,
  upsertMangaContinuityTerm,
  observeMangaContinuityCandidate,
  buildMangaContinuityContextItem,
  mergeMangaTranslationContext,
} = require("./mangaContinuity.cjs");


test(
  "new continuity state is empty",
  () => {
    assert.deepEqual(
      createEmptyMangaContinuityState(),
      {
        version: 1,
        terms: [],
        observations: [],
        updatedAt: null,
      }
    );
  }
);


test(
  "stable Japanese names and terms are eligible",
  () => {
    assert.equal(
      isMangaContinuityCandidate(
        "美咲",
        "Misaki"
      ),
      true
    );

    assert.equal(
      isMangaContinuityCandidate(
        "魔王",
        "Ma Vương"
      ),
      true
    );

    assert.equal(
      isMangaContinuityCandidate(
        "ミサキ",
        "Misaki"
      ),
      true
    );
  }
);


test(
  "ordinary Japanese dialogue is rejected",
  () => {
    assert.equal(
      isMangaContinuityCandidate(
        "はい",
        "Vâng"
      ),
      false
    );

    assert.equal(
      isMangaContinuityCandidate(
        "大丈夫です",
        "Không sao"
      ),
      false
    );

    assert.equal(
      isMangaContinuityCandidate(
        "そうですね",
        "Đúng vậy"
      ),
      false
    );
  }
);


test(
  "sentence-like source is rejected",
  () => {
    assert.equal(
      isMangaContinuityCandidate(
        "魔王！",
        "Ma Vương!"
      ),
      false
    );

    assert.equal(
      isMangaContinuityCandidate(
        "one two three four five",
        "x"
      ),
      false
    );
  }
);


test(
  "user correction creates continuity mapping",
  () => {
    const next =
      upsertMangaContinuityTerm(
        [],
        {
          original: "美咲",
          translatedText:
            "Misaki",
          chapterNumber: 1,
          pageNumber: 8,
          updatedAt: 100,
        }
      );

    assert.equal(
      next.length,
      1
    );

    assert.deepEqual(
      next[0],
      {
        original:
          "美咲",

        translatedText:
          "Misaki",

        vietnamese:
          "Misaki",

        evidence:
          "USER_CORRECTION",

        chapterNumber:
          1,

        pageNumber:
          8,

        updatedAt:
          100,
      }
    );
  }
);


test(
  "later correction replaces same source mapping",
  () => {
    const first =
      upsertMangaContinuityTerm(
        [],
        {
          original: "美咲",
          translatedText:
            "Misaki",
          updatedAt: 100,
        }
      );

    const second =
      upsertMangaContinuityTerm(
        first,
        {
          original: "美咲",
          translatedText:
            "Misaki-san",
          updatedAt: 200,
        }
      );

    assert.equal(
      second.length,
      1
    );

    assert.equal(
      second[0]
        .translatedText,
      "Misaki-san"
    );

    assert.equal(
      second[0]
        .updatedAt,
      200
    );
  }
);


test(
  "continuity keeps newest mappings within limit",
  () => {
    let terms = [];

    for (
      let index = 1;
      index <= 40;
      index++
    ) {
      terms =
        upsertMangaContinuityTerm(
          terms,
          {
            original:
              `TERM${index}`,
            translatedText:
              `VALUE${index}`,
            updatedAt:
              index,
          },
          32
        );
    }

    assert.equal(
      terms.length,
      32
    );

    assert.equal(
      terms[0].original,
      "TERM9"
    );

    assert.equal(
      terms[31].original,
      "TERM40"
    );
  }
);


test(
  "continuity serializes into one context item",
  () => {
    const item =
      buildMangaContinuityContextItem(
        [
          {
            original:
              "美咲",
            translatedText:
              "Misaki",
          },
          {
            original:
              "魔王",
            translatedText:
              "Ma Vương",
          },
        ]
      );

    assert.ok(item);

    assert.equal(
      item.scope,
      "CONTINUITY"
    );

    assert.equal(
      item.blockCount,
      2
    );

    assert.match(
      item.original,
      /美咲/u
    );

    assert.match(
      item.original,
      /魔王/u
    );

    assert.match(
      item.translatedText,
      /Misaki/u
    );

    assert.match(
      item.translatedText,
      /Ma Vương/u
    );

    assert.match(
      item.original,
      /MANGA_CONTINUITY USER_CONFIRMED/u
    );
  }
);


test(
  "continuity remains in context tail when limit is reached",
  () => {
    const recent = [
      { page: 1 },
      { page: 2 },
      { page: 3 },
      { page: 4 },
      { page: 5 },
    ];

    const continuity = {
      scope:
        "CONTINUITY",
    };

    const merged =
      mergeMangaTranslationContext(
        recent,
        continuity,
        5
      );

    assert.equal(
      merged.length,
      5
    );

    assert.deepEqual(
      merged.map(
        (item) =>
          item.page ||
          item.scope
      ),
      [
        2,
        3,
        4,
        5,
        "CONTINUITY",
      ]
    );
  }
);


test(
  "recent context is unchanged when continuity is empty",
  () => {
    const recent = [
      { page: 1 },
      { page: 2 },
    ];

    assert.deepEqual(
      mergeMangaTranslationContext(
        recent,
        null,
        5
      ),
      recent
    );
  }
);


test(
  "zero context entitlement disables both recent and continuity context",
  () => {
    assert.deepEqual(
      mergeMangaTranslationContext(
        [{ page: 1 }],
        {
          scope:
            "CONTINUITY",
        },
        0
      ),
      []
    );
  }
);



test(
  "first automatic observation does not promote",
  () => {
    const result =
      observeMangaContinuityCandidate(
        createEmptyMangaContinuityState(),
        {
          original:
            "美咲",
          translatedText:
            "Misaki",
          chapterNumber: 1,
          pageNumber: 3,
          updatedAt: 100,
        }
      );

    assert.equal(
      result.reason,
      "OBSERVED"
    );

    assert.equal(
      result.promoted,
      null
    );

    assert.equal(
      result.state.terms.length,
      0
    );

    assert.equal(
      result.state
        .observations.length,
      1
    );

    assert.equal(
      result.state
        .observations[0]
        .seenCount,
      1
    );
  }
);


test(
  "same mapping on two distinct pages promotes AUTO_REPEATED",
  () => {
    const first =
      observeMangaContinuityCandidate(
        createEmptyMangaContinuityState(),
        {
          original:
            "美咲",
          translatedText:
            "Misaki",
          chapterNumber: 1,
          pageNumber: 3,
          updatedAt: 100,
        }
      );

    const second =
      observeMangaContinuityCandidate(
        first.state,
        {
          original:
            "美咲",
          translatedText:
            "Misaki",
          chapterNumber: 1,
          pageNumber: 7,
          updatedAt: 200,
        }
      );

    assert.equal(
      second.reason,
      "PROMOTED"
    );

    assert.ok(
      second.promoted
    );

    assert.equal(
      second.promoted
        .evidence,
      "AUTO_REPEATED"
    );

    assert.equal(
      second.promoted
        .seenCount,
      2
    );

    assert.equal(
      second.state
        .observations.length,
      0
    );
  }
);


test(
  "repeating on the same page does not increase evidence",
  () => {
    const first =
      observeMangaContinuityCandidate(
        createEmptyMangaContinuityState(),
        {
          original:
            "魔王",
          translatedText:
            "Ma Vương",
          chapterNumber: 1,
          pageNumber: 4,
        }
      );

    const second =
      observeMangaContinuityCandidate(
        first.state,
        {
          original:
            "魔王",
          translatedText:
            "Ma Vương",
          chapterNumber: 1,
          pageNumber: 4,
        }
      );

    assert.equal(
      second.reason,
      "OBSERVED"
    );

    assert.equal(
      second.state
        .terms.length,
      0
    );

    assert.equal(
      second.state
        .observations[0]
        .seenCount,
      1
    );
  }
);


test(
  "conflicting automatic translations block promotion",
  () => {
    const first =
      observeMangaContinuityCandidate(
        createEmptyMangaContinuityState(),
        {
          original:
            "美咲",
          translatedText:
            "Misaki",
          chapterNumber: 1,
          pageNumber: 1,
        }
      );

    const conflict =
      observeMangaContinuityCandidate(
        first.state,
        {
          original:
            "美咲",
          translatedText:
            "Mỹ Saki",
          chapterNumber: 1,
          pageNumber: 2,
        }
      );

    assert.equal(
      conflict.reason,
      "CONFLICT"
    );

    assert.equal(
      conflict.state
        .terms.length,
      0
    );

    assert.equal(
      conflict.state
        .observations[0]
        .conflicting,
      true
    );

    const later =
      observeMangaContinuityCandidate(
        conflict.state,
        {
          original:
            "美咲",
          translatedText:
            "Misaki",
          chapterNumber: 1,
          pageNumber: 3,
        }
      );

    assert.equal(
      later.state
        .terms.length,
      0
    );

    assert.equal(
      later.promoted,
      null
    );
  }
);


test(
  "USER_CORRECTION cannot be overwritten by automatic learning",
  () => {
    const terms =
      upsertMangaContinuityTerm(
        [],
        {
          original:
            "美咲",
          translatedText:
            "Misaki",
          evidence:
            "USER_CORRECTION",
        }
      );

    const state = {
      version: 1,
      terms,
      observations: [],
      updatedAt: null,
    };

    const result =
      observeMangaContinuityCandidate(
        state,
        {
          original:
            "美咲",
          translatedText:
            "Mỹ Saki",
          chapterNumber: 3,
          pageNumber: 10,
        }
      );

    assert.equal(
      result.reason,
      "USER_CONFIRMED_EXISTS"
    );

    assert.equal(
      result.state
        .terms[0]
        .translatedText,
      "Misaki"
    );

    assert.equal(
      result.state
        .terms[0]
        .evidence,
      "USER_CORRECTION"
    );
  }
);


test(
  "user correction can replace an AUTO_REPEATED term",
  () => {
    const automatic =
      upsertMangaContinuityTerm(
        [],
        {
          original:
            "美咲",
          translatedText:
            "Mỹ Saki",
          evidence:
            "AUTO_REPEATED",
          seenCount: 2,
        }
      );

    const corrected =
      upsertMangaContinuityTerm(
        automatic,
        {
          original:
            "美咲",
          translatedText:
            "Misaki",
          evidence:
            "USER_CORRECTION",
        }
      );

    assert.equal(
      corrected.length,
      1
    );

    assert.equal(
      corrected[0]
        .translatedText,
      "Misaki"
    );

    assert.equal(
      corrected[0]
        .evidence,
      "USER_CORRECTION"
    );
  }
);
