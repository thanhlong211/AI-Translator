# AI Translator Admin Web

Zero-dependency Admin SPA covering the commercial/operations foundation through Batch 14.9.5, with production hardening added in Batch 15.0.7.

## Development

```bash
cd admin-web
npm run dev
```

Open `http://127.0.0.1:4174`. Development `config.js` allows the backend URL field so local environments can switch between backend instances.

## Production

Do **not** deploy `dev-server.mjs` as the public web server. Serve these static files behind HTTPS using a hardened static host/reverse proxy.

Copy `config.production.example.js` to `config.js` on the production host and set the real API origin:

```js
window.AI_TRANSLATOR_ADMIN_CONFIG = {
  backendUrl: "https://api.example.com",
  allowBackendOverride: false,
  requireHttps: true,
};
```

Production mode hides/locks the Backend URL field so Admin credentials cannot be submitted to an arbitrary host. Keep secrets out of `config.js`; it is public browser JavaScript.

Recommended response headers for the Admin host include a strict Content-Security-Policy, HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and `frame-ancestors 'none'`.

Before login, provision/promote the initial `SUPER_ADMIN` using the backend's controlled administration procedure.
