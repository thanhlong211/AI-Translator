# Screenshot Guide for the Public README

The root README already references:

```text
docs/screenshots/translate-workspace.png
```

When the packaged desktop app is ready, replace that file with a real runtime screenshot using the same filename.

## Recommended screenshots

Capture at 1440×900 or 1600×1000 when possible.

1. `translate-workspace.png`
   - Translate page
   - Backend Online
   - Profile controls visible
   - Source + translated result visible

2. `manga-overlay.png`
   - Manga/full-screen overlay
   - Use content you own or a copyright-safe sample
   - Do not show private browser tabs or notifications

3. `novel-reader.png`
   - Novel Reader with a public-domain or self-written text sample

4. `profiles.png`
   - Character rules and glossary
   - Use fictional sample names/terms

5. `admin-dashboard.png`
   - Admin dashboard only with demo data
   - Hide real user emails, transaction IDs, license keys, revenue/private business data, and tokens

## Safety checklist before committing a screenshot

- [ ] No API keys
- [ ] No JWT/access/refresh tokens
- [ ] No database password or connection string
- [ ] No Railway variable values
- [ ] No payment secrets
- [ ] No real user PII
- [ ] No real license key
- [ ] No copyrighted manga page unless you have permission to publish it
- [ ] No personal desktop notifications or browser tabs
