# Batch 13 — Novel Reader TXT

Branch: `feature/batch-13-novel-reader-txt`

## Scope

- New `Novel TXT` workspace in the Desktop sidebar.
- PRO/MANGA_PLUS feature gate via existing `novelReaderTxt` entitlement from V12.
- Native Electron `.txt` file picker.
- Local file reading; the whole novel is never uploaded to the backend.
- Supported encodings in this batch: UTF-8, UTF-8 BOM, UTF-16 LE, UTF-16 BE.
- Shift-JIS-like decoding errors are rejected with a clear message instead of sending mojibake to AI.
- Paragraph/chapter segmentation; each translation block stays under the backend 1200-character limit.
- Chapter markers include `第N章/話/節/巻/部`, `Chapter N`, `Chương N`, `Prologue`, `Epilogue`, `序章`, `終章`, `幕間`, `間章`.
- Reader translates only requested blocks: 1–8 per batch (`6` by default), never the whole book automatically.
- Context uses the latest translated paragraphs in the same novel, up to the existing backend limit of 10.
- Personal Translation Memory remains checked per block before AI.
- Current Reader session remains in memory when switching app tabs.
- Reading progress and up to 160 recent translations are stored locally for up to 5 recent TXT files; reopening the same unchanged file restores them.
- New backend batch `purpose = NOVEL` adds a prose-focused prompt and backend entitlement enforcement.
- No Flyway migration: V12 already has `novelReaderTxt = FALSE` for FREE and `TRUE` for PRO/MANGA_PLUS.

## Apply

Copy the patch contents into the repository root, preserving paths.

## Test matrix

### FREE

- Open `Novel TXT` in the sidebar.
- It must show the PRO paywall.
- Direct backend `purpose=NOVEL` must also be denied.

### PRO

- Open `samples/novel-reader-test.txt`.
- Reader should detect 2 chapter markers.
- Select a saved Translation Profile.
- Click `Dịch 6 đoạn tiếp`.
- Original and translated paragraphs should appear side-by-side.
- `Memory N · AI N` should match backend batch summary.
- Switch to another app tab and back: the open Reader session should remain.
- Close/reopen the same TXT: reading position/recent translations should restore locally.
- Continuous Manga remains unavailable, unchanged from Batch 12.

### MANGA_PLUS

- Same Novel Reader behavior as PRO.
- Continuous Manga remains available.

## Validation performed

- Electron `main.cjs` syntax PASS.
- Electron `preload.cjs` syntax PASS.
- TypeScript integration compile for App + Novel Reader + sidebar/topbar/types PASS.
- `PromptBuilderService` targeted Java compile PASS.
- `BatchTranslationService` targeted Java compile PASS.
- `BatchTranslationController` targeted Java compile PASS.
- Existing migrations remain V1–V13 only; no Flyway file changed.

## Git after Windows runtime test passes

Suggested commit:

```bash
git add backend/src/main/java/com/dangt/aitranslator/backend/profile/PromptBuilderService.java \
        backend/src/main/java/com/dangt/aitranslator/backend/translation/batch/BatchTranslationController.java \
        backend/src/main/java/com/dangt/aitranslator/backend/translation/batch/BatchTranslationPurpose.java \
        backend/src/main/java/com/dangt/aitranslator/backend/translation/batch/BatchTranslationService.java \
        desktop/electron/main.cjs \
        desktop/electron/preload.cjs \
        desktop/src/App.tsx \
        desktop/src/app/types.ts \
        desktop/src/components/Icon.tsx \
        desktop/src/components/Sidebar.tsx \
        desktop/src/components/Topbar.tsx \
        desktop/src/index.css \
        desktop/src/pages/NovelReaderPage.tsx

git commit -m "feat(novel): add TXT reader with contextual batch translation"
```

The `samples/` file is only for local testing; do not stage it unless you intentionally want it in the repository.
