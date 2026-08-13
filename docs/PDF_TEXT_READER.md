# PDF Text Reader · Batch 14.2

Batch 14.2 adds text-based PDF as a Document Reader adapter.

## Pipeline

PDF file -> local Electron parser -> page text -> repeated header/footer cleanup -> paragraph normalization -> Document Reader Core -> translation batch.

The whole PDF stays local. Only selected normalized blocks are sent to the existing translation backend.

## Supported baseline

- Classic PDF indirect page/content objects.
- FlateDecode, ASCII85Decode and ASCIIHexDecode content streams.
- WinAnsi/single-byte text.
- Fonts with ToUnicode CMap.
- Common CJK UCS2 encodings such as UniJIS-UCS2-H/V, UniGB-UCS2-H/V, UniCNS-UCS2-H/V and UniKS-UCS2-H/V.
- Repeated short header/footer removal.
- Chapter heading detection and 1100-character block normalization.

## Deliberate limits

- Encrypted/password/DRM PDF is rejected.
- Image-only/scanned PDF is detected as having too little extractable text and points to Batch 14.3 PDF OCR Reader.
- Some PDFs that place page dictionaries only inside compressed object streams may not be readable by this lightweight parser yet.
- Maximum file size: 100 MB. Reader processes up to 2500 pages per file.

No third-party PDF parser is added to npm dependencies in this batch.
