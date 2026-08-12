# Batch 13.2.1 — Reader Font Settings

Adds a dedicated **Novel Reader Font** section to Settings.

## What changed
- Settings presets: Auto, Serif, Sans, Japanese Gothic, Japanese Mincho, System, Custom.
- Custom font family input with CJK-safe fallback stack.
- Live multilingual preview (Japanese / Vietnamese / English).
- Settings stored locally under `aiTranslator.novelReader.fontSettings.v1`.
- Novel Reader reacts to the saved setting without backend/DB changes.
- `Auto` preserves Batch 13.1.1 language-aware font fallback.

## Files
- `desktop/src/pages/SettingsPage.tsx`
- `desktop/src/pages/NovelReaderPage.tsx`
- `desktop/src/index.css`

No backend, Flyway, license, or entitlement changes.
