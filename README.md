# Batch 14.1 — Generic Document Reader Core

Refactor-only foundation batch after EPUB support. No new end-user file format is introduced in this batch.

## What changed

- Added `desktop/electron/documentReaderCore.cjs`.
- Added a single format registry for TXT and EPUB.
- TXT parsing moved from React into Electron and now returns the same normalized block model as EPUB.
- Added generic IPC: `novel:list-formats`, `novel:open-document`, `novel:read-document`.
- Kept legacy TXT/EPUB IPC wrappers for compatibility.
- Added `desktop/src/app/documentReader.ts` as the shared renderer document model.
- `NovelReaderPage` now consumes normalized document blocks instead of containing a TXT parser.
- Translation capability and backend purpose are resolved from the format registry.
- Existing Library/progress/bookmarks/cache keys are unchanged.

## No production data changes

- No DB migration.
- No Flyway change.
- No entitlement matrix change.
- No license change.
- No Translation Memory schema change.

## Validation

- `node --check documentReaderCore.cjs` PASS
- `node --check main.cjs` PASS
- `node --check preload.cjs` PASS
- TypeScript strict check for `NovelReaderPage.tsx` + `documentReader.ts` PASS
- TXT parser synthetic test PASS: 5 blocks / 2 chapters
- EPUB3 sample PASS: title/author / 6 blocks / 2 chapters
- generic picker/read adapter PASS
- capability routing PASS (`TXT -> novelReaderTxt`, `EPUB -> novelReaderEpub`)
- translation routing PASS (`TXT -> NOVEL`, `EPUB -> NOVEL_EPUB`)

See `docs/DOCUMENT_READER_CORE.md` for the adapter contract used by future PDF/DOCX support.
