# Document Reader Core

Batch 14.1 moves TXT and EPUB behind one local document-reader contract so new formats can reuse the existing Reader UI and translation pipeline.

## Unified flow

```text
File picker / Library path
        |
        v
Document format registry
        |
        +-- capability (license gate)
        +-- max file size
        +-- parser
        +-- translation purpose
        |
        v
Unified document payload
        |
        +-- file metadata
        +-- blocks
        +-- chapters
        +-- metadata
        |
        v
Novel Reader UI
```

## Electron contract

`desktop/electron/documentReaderCore.cjs` owns the format registry and exposes:

- `readDocumentPath(path, options)`
- `openDocumentFiles(options)`
- `getTranslationRouteForFormat(format)`
- `listDocumentFormats()`
- normalized block/chapter output

Current registry:

| Format | Extension | Capability | Translation purpose |
| --- | --- | --- | --- |
| TXT | `.txt` | `novelReaderTxt` | `NOVEL` |
| EPUB | `.epub` | `novelReaderEpub` | `NOVEL_EPUB` |

The renderer uses generic IPC:

- `novel:open-document`
- `novel:read-document`
- `novel:list-formats`

The older TXT/EPUB IPC handlers remain as compatibility wrappers for this release.

## Renderer model

`desktop/src/app/documentReader.ts` is the shared TypeScript document model:

- `DocumentReaderFormat`
- `DocumentReaderFileInfo`
- `DocumentReaderBlock`
- `DocumentReaderChapter`
- `DocumentReaderOpenPayload`

`NovelReaderPage` no longer parses TXT itself. Both TXT and EPUB arrive as normalized blocks from Electron.

## Backward compatibility

Library/progress storage keys are unchanged. Existing TXT/EPUB entries keep their file-path identity, progress, bookmarks, saved translations and per-book reader preferences.

## Adding PDF/DOCX later

A new format should be added in this order:

1. Add one registry entry (extension, capability, size limit, translation purpose).
2. Add one parser that returns normalized blocks/chapters/metadata.
3. Extend `DocumentReaderFormat` in the renderer.
4. Add the entitlement key/purpose on the backend if the product plan needs a separate gate.
5. Add one UI import button/filter.

The Library, progress, bookmarks, search, themes, font settings, language switching, context and Translation Memory do not need to be reimplemented.
