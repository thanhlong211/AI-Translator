# Batch 14.5 — Admin Console MVP

## Included

- Separate `admin-web/` application on port 4174, zero npm runtime dependencies.
- Dedicated Admin login endpoint with short-lived JWT and no refresh session.
- Roles: existing `USER`, plus `ADMIN` and `SUPER_ADMIN` values supported by Admin guard.
- Dashboard: users, active/suspended users, active sessions, translation usage today/month, effective plan distribution, recent audit.
- User management: search, detail, identities, active sessions, monthly usage.
- User actions: suspend/reactivate, revoke all sessions.
- Plan override: FREE/PRO/MANGA_PLUS or any active plan from `plan_catalog`, optional expiry, with reversible override semantics.
- Admin audit log for successful login and all mutating Admin actions.
- Configurable CORS for Desktop + Admin Web.

## Migration

Adds only:

`backend/src/main/resources/db/migration/V17__add_admin_console_foundation.sql`

Do not edit V1–V16.

## First Admin

1. Register/login an ordinary local email/password account.
2. Open `backend/mysql/promote-super-admin.sql` locally.
3. Replace `CHANGE_ME_ADMIN_EMAIL@example.com` with that account email.
4. Run the SQL against schema `ai_translator`.
5. Restart/login to Admin Web.

Never commit a real admin password. The SQL file contains no password.

## Run Admin Web

```bash
cd admin-web
npm run dev
```

Open:

`http://localhost:4174`

Backend default:

`http://localhost:8080`

## Runtime test checklist

1. Flyway reaches V17 and backend starts.
2. Normal USER cannot login through Admin Console.
3. SUPER_ADMIN can login.
4. Dashboard loads.
5. Search a user and open detail.
6. Change PRO/FREE/MANGA_PLUS override with a reason.
7. Desktop entitlement for that user changes after refresh/re-login.
8. Clear override: entitlement returns to underlying license/subscription.
9. Suspend user: all refresh sessions are revoked and authenticated APIs reject the suspended account.
10. Reactivate user and verify login works again.
11. Audit view shows every mutation with actor, target, reason and time.

## Deliberately deferred

- Batch 14.6: editable plan catalog, features and quota limits.
- Batch 14.7: prices, billing intervals, promotions and transaction model.
- Batch 14.8: provider/model token usage and estimated AI cost analytics.
- Batch 14.9: Admin MFA/SSO, rate limiting, richer audit metadata and production operations.
