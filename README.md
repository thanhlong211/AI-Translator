# Batch 12 — Plans / Entitlements / License

Branch: `feature/batch-12-plans-entitlements`

## What changed

- Backend is now the source-of-truth for plan, features and limits.
- Flyway V12 adds plan catalog, feature entitlements, plan limits, license keys and license activations.
- Plans seeded: `FREE`, `PRO`, `MANGA_PLUS`.
- `continuousManga` is OFF for FREE/PRO and ON for MANGA_PLUS.
- Desktop Batch 11 no longer hard-codes Continuous Manga as available.
- Settings has a Plan & License section with current plan, capabilities, quota and license activation.
- `/api/v1/translate` and `/api/v1/translate/batch` enforce `monthlyTranslations` before calling AI.
- A local-only `AI_TRANSLATOR_DEV_PLAN` override exists for development testing.
- Local helper `backend/mysql/create-dev-license.sql` creates a 30-day MANGA_PLUS test license.

## Endpoints

- `GET /api/v1/account/entitlements`
- `POST /api/v1/account/license/activate`

Activation body:

```json
{
  "licenseKey": "AIT-..."
}
```

Raw license keys are never stored in MySQL. Backend normalizes the key and stores/looks up SHA-256 only.

## Local test — fastest path

Set backend environment variable before startup:

```bash
export AI_TRANSLATOR_DEV_PLAN=MANGA_PLUS
```

Then login Desktop. Settings should show `Manga+ · DEVELOPMENT_OVERRIDE`, and Auto Manga should be available.

Unset it to verify FREE gating:

```bash
unset AI_TRANSLATOR_DEV_PLAN
```

Restart backend + login again. Settings should show FREE and Continuous Manga should be unavailable.

## Local test — real license activation path

Leave `AI_TRANSLATOR_DEV_PLAN` blank. Run:

`backend/mysql/create-dev-license.sql`

Then paste the returned local test key into Settings → Plan & License → License key. The effective plan should become MANGA_PLUS.

## Security change

`application.properties` no longer contains fallback DB/JWT credentials. Configure these outside Git:

- `DB_PASSWORD`
- `JWT_SECRET_BASE64`
- `OPENAI_API_KEY`

Because older values were already committed before this patch, rotate the DB password and JWT secret. Rotating JWT intentionally invalidates existing access/refresh authentication state as appropriate; users may need to log in again.

## Validation performed

- `node --check desktop/electron/main.cjs` — PASS
- `node --check desktop/electron/preload.cjs` — PASS
- TypeScript parse/type integration with local React stubs — PASS
- New entitlement/license Java package compiled with dependency stubs — PASS
- Modified normal + batch translation controllers compiled with dependency stubs — PASS
- Secret-pattern scan on reconstructed tracked source — no matching committed fallback credentials

Full Maven/Vite dependency builds were not possible in the sandbox because project dependencies are not installed/cached there. Run your normal backend + Vite + Electron runtime test on Windows before committing.

## Suggested commit after Windows test

```bash
git add .env.example backend desktop
git commit -m "feat(billing): add plans entitlements and license activation"
```
