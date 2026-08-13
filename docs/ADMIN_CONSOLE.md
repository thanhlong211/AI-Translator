# Batch 14.5 — Admin Console

## Security model

- Admin Web is a separate application under `admin-web/`.
- `/api/v1/admin/auth/login` accepts only existing ACTIVE users whose DB role is `ADMIN` or `SUPER_ADMIN`.
- Admin login issues a short-lived JWT only; it does not create a refresh-token/device session.
- All other `/api/v1/admin/**` endpoints require JWT authentication and then verify the role from the current DB user.
- The browser stores the Admin JWT in `sessionStorage`; closing the browser tab/session clears it.
- User password hashes, social-provider access tokens, document text, screenshots and translation content are never returned by Admin APIs.

## First SUPER_ADMIN

Register a normal account first, then edit `backend/mysql/promote-super-admin.sql` locally and replace the placeholder email. Never commit a real administrator email if you do not want it in Git history.

## Plan overrides

Admin plan changes are stored in `user_plan_overrides`. They take precedence over a license/subscription while active, but do not mutate the underlying license/subscription. Clearing the override restores normal entitlement resolution.

## Audit

These actions are recorded in `admin_audit_log`:

- successful Admin login
- user status changes
- revoke-all-sessions
- set plan override
- clear plan override

Price editing, feature-matrix editing and AI token/cost accounting are intentionally deferred to Batch 14.6–14.8.
