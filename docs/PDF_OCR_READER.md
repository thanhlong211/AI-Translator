# PDF OCR Reader architecture

## Goal

Support scanned/image-only PDF documents without OCRing an entire book up front and without adding a system-level PDF renderer dependency.

## Pipeline

`PDF_OCR` → inspect PDF locally → extract page image → Sharp PNG → existing PaddleOCR worker → reconstruct reading blocks → local page cache → shared Document Reader → translation batch with `purpose=PDF_OCR`.

Only OCR text selected for translation is sent to the backend. PDF bytes and temporary page images remain local.

## Lazy OCR and cache

The Reader initially requests a small page window. Each successfully OCRed page is stored as normalized text blocks in Electron user data. The cache identity is derived from absolute path, file size and modification timestamp, so replacing/editing the PDF invalidates the previous OCR cache automatically.

Temporary PNG files live in the operating-system temp directory only for the OCR request and are deleted in a `finally` block.

## Page-image extraction

`pdfOcrParser.cjs` parses ordinary indirect PDF page/resource/image objects and selects large image XObjects. Common scan encodings are decoded locally. This design is intentionally lighter than a complete PDF rendering engine and therefore rejects unsupported codecs/structures rather than returning corrupted OCR input.

## Entitlement

Desktop capability: `pdfOcrReader`.

Backend translation purpose: `PDF_OCR`.

Flyway V15 enables it for PRO and MANGA_PLUS and disables it for FREE. The backend checks the capability again on `/api/v1/translate/batch`, so UI bypass does not grant translation access.
