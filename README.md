# Batch 14.2 · PDF Text Reader

Branch: `feature/batch-14-2-pdf-text-reader`

## What changes

- Adds `PDF_TEXT` to Generic Document Reader Core.
- Adds local Electron PDF text extraction (`pdfTextParser.cjs`).
- Reader Library can import/reopen TXT, EPUB and text-based PDF.
- PDF uses existing progress, bookmarks, search, themes, font settings, profiles, language switching and Translation Memory.
- Adds backend `BatchTranslationPurpose.PDF_TEXT` and feature gate `pdfTextReader`.
- Adds Flyway `V14__add_pdf_text_reader_entitlement.sql`.
- FREE: PDF Text OFF. PRO/MANGA_PLUS: PDF Text ON.
- Settings → Plan & License shows PDF Text Reader capability.

## Safety / limitations

PDF stays local; only blocks selected for translation go to backend. Encrypted PDF is rejected. Image-only/scan PDF reports that PDF OCR Reader is needed (planned Batch 14.3).

The parser supports common PDF text streams including Flate/ASCII85/ASCIIHex, ToUnicode CMaps, WinAnsi and common CJK UCS2 encodings. Some highly compressed object-stream-only PDFs may still be unsupported in this lightweight baseline.

## Test

Use `samples/pdf-text-reader-test.pdf` (3 pages / 3 chapters) or `samples/pdf-text-reader-japanese-test.pdf`.

1. Login with PRO/MANGA_PLUS.
2. Reader → `+ PDF`.
3. Open a sample PDF.
4. Verify chapter navigation, search, bookmark and progress.
5. Translate several blocks to VI, then switch target to EN and translate again.
6. Reopen the PDF from Library with Continue Reading.
7. FREE account must not be allowed to open/translate PDF.

## Validation completed

- `node --check`: main/preload/documentReaderCore/pdfTextParser PASS.
- TypeScript strict semantic check: NovelReaderPage + SettingsPage + documentReader PASS.
- Java compile with dependency stubs: purpose/controller/prompt PASS.
- Parser tests: Latin PDF PASS, Japanese UniJIS-UCS2 PDF PASS, direct ToUnicode CMap PASS.
- Image-only PDF detection PASS.
- No V1-V13 migration was edited.
