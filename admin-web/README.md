# AI Translator Admin Web

Zero-dependency Admin SPA for Batch 14.6.

```bash
cd admin-web
npm run dev
```

Open `http://127.0.0.1:4174`.

The backend development CORS default allows both `http://localhost:4174` and the Desktop Vite origin. If you open the Admin console as `127.0.0.1`, either use `http://localhost:4174` in the browser or include `http://127.0.0.1:4174` in `APP_CORS_ALLOWED_ORIGINS`.

Before login, promote one existing local-password account to `SUPER_ADMIN` using the supplied SQL template under `backend/mysql/promote-super-admin.sql`.


## Batch 14.6

Plans & Features now supports dynamic plan creation and editing. Feature and limit keys are read from the backend schema; plan codes are immutable after creation. Pricing remains out of scope until Batch 14.7.
