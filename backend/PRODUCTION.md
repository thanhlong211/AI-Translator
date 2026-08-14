# Backend production checklist

Batch 14.9.6 adds a strict `prod` profile. Start production with:

```text
SPRING_PROFILES_ACTIVE=prod
```

Required runtime secrets/settings:

```text
DB_URL=<TLS-enabled MySQL JDBC URL>
DB_USERNAME=<database user>
DB_PASSWORD=<database password>
JWT_SECRET_BASE64=<at least 32 random bytes after Base64 decode>
OPENAI_API_KEY=<server-side OpenAI key>
CORS_ALLOWED_ORIGINS=https://admin.example.com
```

Recommended operational settings:

```text
SERVER_PORT=8080
ADMIN_ANALYTICS_TIME_ZONE=Asia/Ho_Chi_Minh
AI_COST_REPORTING_CURRENCY=USD
```

The `prod` profile intentionally fails startup when critical hardening is missing:

- DB password or JWT secret is blank.
- CORS is empty, wildcard, localhost, or HTTP while HTTPS is required.
- Swagger/OpenAPI endpoints are enabled.
- Actuator exposes endpoints other than `health` / `info`.
- forwarded-header processing is not enabled.
- framework error messages or stack traces are exposed.
- DB TLS is explicitly disabled or `allowPublicKeyRetrieval=true` is present.

For an isolated production-like test only, DB TLS or HTTPS-CORS validation can be
explicitly disabled with `REQUIRE_DB_TLS=false` or `REQUIRE_HTTPS_CORS=false`.
Do not use those overrides for an Internet-facing deployment.

## Reverse proxy boundary

`server.forward-headers-strategy=framework` is enabled in production so the app
can recognize HTTPS behind a reverse proxy and emit HSTS. Do not expose the
backend port directly to the Internet while also accepting untrusted forwarded
headers. Restrict direct access to the trusted proxy/load balancer.

## Public surface

Production disables Swagger and exposes only Actuator health probes. API
responses receive restrictive security headers, and `/api/**` responses are
marked `no-store` to reduce accidental caching of authenticated data.

## Password reset delivery

Production password recovery uses SMTP. Configure these variables before starting the `prod` profile:

```text
PASSWORD_RESET_DELIVERY=SMTP
PASSWORD_RESET_URL_BASE=https://<account-host>/reset-password   # optional; email always includes a reset code
PASSWORD_RESET_MAIL_FROM=no-reply@<your-domain>
MAIL_HOST=<smtp-host>
MAIL_PORT=587
MAIL_USERNAME=<smtp-user>
MAIL_PASSWORD=<smtp-password>
MAIL_SMTP_AUTH=true
MAIL_STARTTLS=true
```

The public forgot-password API never returns a reset token. In the `dev` profile with `PASSWORD_RESET_DELIVERY=LOG`, the one-time reset code is printed only to the local backend console for manual testing. Production must use SMTP delivery.
