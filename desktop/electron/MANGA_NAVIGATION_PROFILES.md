# Manga Navigation Profiles — Batch 15.0.3

`⏭` no longer sends ArrowRight by default.

Each manga site can have its own local navigation profile:

- `MANUAL`: user changes page; `⏭` translates the current page (same behavior as Ctrl+Shift+Y).
- `KEY`: Arrow Left/Right, Page Up/Down, Space, or Enter.
- `CLICK`: click a saved relative point in the source browser window.
- `SCROLL`: mouse-wheel up/down for vertical readers/webtoons.

The profile is matched using the source process name plus a stable `titleContains` string chosen by the user. Profiles are stored in Desktop `app-preferences.json`; no backend or database migration is involved.

For `CLICK`, use the capture button in the configuration window. AI Translator hides its overlay, focuses the source browser, and records the next mouse click relative to that browser window. The click can advance the reader once; after saving, use Ctrl+Shift+Y if the new page still needs translation.

The old image-fingerprint guard remains in place: if the configured action does not visibly change the manga region, AI Translator restores the previous overlay and asks the user to reconfigure instead of OCR/translating the same page again.
