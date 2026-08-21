# Security Hardening — BlackWhip SentinelX

Status of the Tier-3 hardening fixes (applied 2026-08-21) plus follow-up
hardening (2026-08-21) and the items that require a human with access to
external consoles.

## Applied in code

| # | Item | Status | Where |
|---|------|--------|-------|
| 11 | **Secrets enforcement** | ✅ Server refuses to boot with a missing/placeholder `JWT_SECRET` or `ADMIN_PASSWORD` (logs `boot_aborted_*` and exits). | `backend/server.ts` (`validateSecrets`) |
| 11 | **Scrubbed personal email** | ✅ `test-auth.cjs` no longer contains a real personal email. | `test-auth.cjs` |
| 12 | **Real RBAC** | ✅ `requireAnalyst` now enforces `ADMIN`/`ANALYST`/`ROOT` (was a no-op); `requireAuth` re-checks the user against SQLite on every request so deleted users are locked out immediately and role changes apply without re-login. | `backend/server.ts` |
| 12 | **Analyst provisioning** | ✅ New admin-only endpoints: `GET /api/users`, `POST /api/users` (email/password/role, min 8-char password), `DELETE /api/users/:id` (self-delete blocked). All audited (`CREATE_USER` / `DELETE_USER`). UI: Access Control tab → `UserManagement.tsx` (admin only). | `backend/server.ts`, `frontend/src/components/UserManagement.tsx` |
| 13 | **CORS lockdown** | ✅ Default is same-origin only (dashboard is served by this server). Allowlist via `CORS_ORIGINS` (comma-separated). | `backend/server.ts`, `.env.example` |
| 14 | **No JWT in SSE query string** | ✅ New `POST /api/stream/token` issues a 2-minute, stream-scoped JWT; `/api/stream` rejects tokens without `scope: 'stream'`. Frontend auto-reconnects with a fresh token. | `backend/server.ts`, `frontend/src/App.tsx` |
| 15 | **Event persistence** | ✅ Every normalized event is written to SQLite (`events` table, indexed by timestamp/hostname/type); the last 500 events are restored into memory at boot (burst-rule history too); `/api/events/search` falls back to SQLite when OpenSearch is down. | `backend/db.ts`, `backend/server.ts` |
| 16 | **`.gitignore`** | ✅ `data/` and `*.db` (password hashes + audit trail + events) are no longer tracked. | `.gitignore` |
| 16 | **Crash handling** | ✅ `uncaughtException` logs then exits (no serving from a corrupt process). | `backend/server.ts` |
| 16 | **Health endpoint** | ✅ Unauthenticated `GET /api/health` (status/uptime/timestamp/mode) for load balancers. | `backend/server.ts` |
| 16 | **TLS verification defaults** | ✅ `WAZUH_VERIFY_TLS` / `OPENSEARCH_VERIFY_TLS` now default to **true** outside `NODE_ENV=development`; labs opt out explicitly with `=false`. | `backend/wazuh.ts`, `backend/opensearch.ts` |

## Follow-up hardening (same day)

| Item | Status | Where |
|------|--------|-------|
| **JWT out of localStorage** | ✅ Hybrid session: the JWT is stored in localStorage (primary — works in embedded/iframe previews where third-party cookies are blocked) **and** set as an httpOnly SameSite=Lax cookie (fallback). `authFetch` prefers the bearer token, cookies cover requests without one; `POST /api/logout` clears both. | `backend/server.ts`, `AuthProvider.tsx`, `utils.ts` |
| **CSRF guard** | ✅ State-changing requests carrying an `Origin` header are rejected when the origin host ≠ request host (cookie sessions can't be CSRF'd cross-site). | `backend/server.ts` |
| **Rate limiting breadth** | ✅ `adminLimiter` on `/api/users*` (60/15min), `chatLimiter` on `/api/chat*` (30/min), `auditLimiter` on `POST /api/audit` (30/min). | `backend/server.ts` |
| **Firestore self-escalation** | ✅ `firestore.rules` rewritten: role comes from **custom claims** (`request.auth.token.role`), users can never write their own `role` field; events are server-write-only. | `firestore.rules` |
| **Firebase config committed** | ✅ `firebase-applet-config.json` values scrubbed to placeholders (the file is unused at runtime). If that Firebase project is ever used, paste fresh values in. | `firebase-applet-config.json` |
| **Trust proxy** | ✅ `trust proxy` only enabled with `TRUST_PROXY=true` — prevents client IP spoofing (rate limiting + audit) on direct exposure. | `backend/server.ts`, `.env.example` |

## Demo / preview mode (AUTO_AUTH)

| Setting | Effect |
|---|---|
| `AUTO_AUTH=true` | **No login page.** Every unauthenticated request is treated as the seeded admin (`ADMIN_EMAIL`). Intended for demos/previews/embedded iframes where cookies and storage may be blocked. |
| `AUTO_AUTH=false` (default) | Normal secured operation with the login page. |

⚠️ **Never enable `AUTO_AUTH` in production** — anyone who can reach the server is admin.

## Still requires a human (cannot be done from this repo)

| Item | Action |
|------|--------|
| **Firebase project** | If the `protean-crane-ft8c4` project is ever used, generate fresh credentials and rotate the old API key in the Firebase console (values in `firebase-applet-config.json` are now placeholders). |
| **JWT secret + admin password** | Generate with `openssl rand -hex 32` and a strong admin password; never use the `.env.example` placeholders. |
| **Production TLS** | Deploy behind HTTPS (reverse proxy / LB) and set `TRUST_PROXY=true` there so `X-Forwarded-For` is honored. |
| **Firestore custom claims** | Before enabling Firebase auth, provision roles via Firebase custom claims from a privileged server (the rules now expect `request.auth.token.role`). |
| **2FA / password reset** | Not implemented — acceptable for a lab; required before any real deployment. |

## Verified behavior (test run)

- Weak/placeholder secrets → boot aborted with structured error log, exit code 1.
- Admin can create an ANALYST via `POST /api/users`; analyst can log in, use analyst endpoints, and is **403**-rejected from `/api/users`.
- `/api/stream` accepts the 2-minute stream token and rejects the long-lived API token.
- Events persisted across a server restart; threat hunting search works with OpenSearch offline (SQLite fallback).
- CORS: cross-origin browser requests get no `Access-Control-Allow-Origin` unless the origin is in `CORS_ORIGINS`.
