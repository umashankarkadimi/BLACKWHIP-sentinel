# BlackWhip SentinelX

AI-powered end-to-end SOC incident handling & attack simulation platform.

A single-server **real-time** security console: ingest live telemetry from
Wazuh/OpenSearch or HTTP forwarders, detect attacks with MITRE-mapped rules,
correlate incidents, triage them with Gemini ("Paul"), and respond via Wazuh
Active Response — all pushed live to a React dashboard over SSE.

> **Real-time only.** The platform runs exclusively on live telemetry — there is
> no simulator and no simulation mode. Events come from the OpenSearch collector
> and/or `POST /api/events/ingest`.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (see .env.example)
cp .env.example .env
#   - Set a strong JWT_SECRET (openssl rand -hex 32)
#   - Set a strong ADMIN_PASSWORD (min 8 chars)
#   - Point at your real sources: WAZUH_API_* / OPENSEARCH_URL / OPENSEARCH_ALERTS_INDEX
#   - Optional: GEMINI_API_KEY for Paul AI

# 3. Run
npm run dev        # http://localhost:8443

# 4. Login with ADMIN_EMAIL / ADMIN_PASSWORD from .env
```

> The server **refuses to boot** with placeholder secrets. Use real values.

### Demo/preview mode (no login page)

Set `AUTO_AUTH=true` in `.env` and the dashboard opens **directly as the
admin — no login screen** (useful for demos and embedded previews where
cookies/storage may be blocked). **Never enable it in production** — anyone
who can reach the server becomes admin.

## Telemetry Sources (real-time only)

There is **no simulator** — every event must come from a live source:

1. **OpenSearch collector** — polls `OPENSEARCH_ALERTS_INDEX` (default
   `wazuh-alerts-4.*`) every 5s for real Wazuh alerts.
2. **HTTP ingest** — external forwarders / lab sensors POST Wazuh-shaped JSON to
   `POST /api/events/ingest` (auth: `X-Ingest-Key` header or a valid JWT).

With no source connected, the dashboard shows a "no events received" banner and
zeroed KPIs — the pipeline is live and waiting for data.

## Features

- **Real-time pipeline (no simulation)** — OpenSearch collector (5s poll, configurable index) + HTTP ingest API + SSE push to the browser
- **Detection** — live-editable MITRE-mapped rules (SQLite-backed, full CRUD in the Rules tab), threshold windows, alert aggregation (5-min dedup with counts)
- **Incidents** — correlation by host *or* user, severity escalation, AI triage (async), 6-tab investigation view (Summary / Attack Graph / Timeline / Response / Report / Nexus chat)
- **SOAR** — Wazuh agent inventory + host isolation (manual & autonomous defense), IP blocking records, incident lifecycle with audit trail, playbook inventory in the Workflows tab
- **Security** — bcrypt + JWT (httpOnly cookie for the browser), RBAC (ADMIN/ANALYST/ROOT), per-request user checks, rate limiting, CORS allowlist, short-lived SSE stream tokens, server-stamped audit trail
- **Ops** — structured JSON logs (trace `event → alert → incident → AI`), boot integration checks, `/api/health`, `npm run db:backup`, `npm test` smoke suite

## Environment Variables

See [`.env.example`](.env.example) for the full annotated list. Key ones:

| Var | Purpose |
|---|---|
| `JWT_SECRET` | JWT signing secret (required, strong) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | First admin (seeded at boot, required, strong) |
| `PORT` | HTTP port (default 3000) |
| `WAZUH_API_URL` / `WAZUH_API_USERNAME` / `WAZUH_API_PASSWORD` | Wazuh manager API |
| `OPENSEARCH_URL` / `OPENSEARCH_USERNAME` / `OPENSEARCH_PASSWORD` | OpenSearch indexer |
| `OPENSEARCH_ALERTS_INDEX` | Index holding the real alert stream (default `wazuh-alerts-4.*`) |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Paul AI triage + chat (also accepts `PAUL_AI_API_KEY`) |
| `VIRUSTOTAL_API_KEY` / `OTX_API_KEY` | IOC hash enrichment |
| `INGEST_API_KEY` | Shared key for external forwarders → `POST /api/events/ingest` |
| `WEBHOOK_URL` | Push HIGH/CRITICAL alerts + new incidents (Slack/Discord/SIEM) |
| `CORS_ORIGINS` | Comma-separated browser origin allowlist (empty = same-origin only) |
| `TRUST_PROXY` | `true` only behind a reverse proxy that sets `X-Forwarded-For` |
| `LOG_LEVEL` | `debug` / `info` / `warn` / `error` |

## API Overview

| Area | Endpoints |
|---|---|
| Auth | `POST /api/login`, `POST /api/logout`, `GET /api/me` |
| State | `GET /api/state`, `GET /api/state/mode`, `POST /api/state/defense`, `GET /api/state/telemetry` |
| Events | `POST /api/events/ingest`, `GET /api/events`, `GET /api/events/search` |
| Detection | `GET/POST/PUT/DELETE /api/rules` |
| Incidents | `GET /api/incidents`, `GET /api/incidents/:id`, `POST /api/incidents/:id/action` |
| Response | `GET /api/wazuh/agents`, `GET /api/blocked-ips` |
| AI | `POST /api/chat`, `POST /api/chat/global` |
| Admin | `GET/POST/DELETE /api/users` |
| Ops | `GET /api/audit`, `POST /api/audit`, `GET /api/workflows`, `POST /api/stream/token`, `GET /api/stream`, `GET /api/health` |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run the server (tsx) with Vite dev middleware |
| `npm run build` | Build the frontend + bundle the server |
| `npm start` | Run the production bundle (`dist/server.cjs`) |
| `npm run lint` | `tsc --noEmit` type check |
| `npm test` | End-to-end smoke test (boots server, asserts core paths) |
| `npm run db:backup` | Copy `data/soc.db` → `backups/` (safe while running) |
| `npm run clean` | Remove `dist/` and stray build artifacts |

## Project Structure

```
backend/            Express server: server.ts (routes/pipeline), db.ts (SQLite),
                    rules.ts (seed rules), ai.ts (Paul), wazuh.ts, opensearch.ts,
                    threatintel.ts, webhook.ts, logger.ts,
                    services/wazuh-alert-collector.ts
frontend/           React 19 SPA (Vite + Tailwind 4)
app/                AI-Studio applet scaffold (mock integrations, unused at runtime)
scripts/            smoke-test.cjs (npm test), backup-db.cjs, legacy/ (archived codemods)
data/               SQLite database (created at runtime, gitignored)
backups/            Database backups (gitignored)
```

## Security

See [`SECURITY.md`](SECURITY.md) for the hardening status and the items that
still require human action (Firebase key rotation if that project matters,
HTTPS termination, custom-claims provisioning if Firestore is ever enabled).

## Documentation

- [`REPOSITORY_ANALYSIS.md`](REPOSITORY_ANALYSIS.md) — full file-by-file analysis
- [`WORKFLOW.md`](WORKFLOW.md) — flowcharts of every pipeline
- [`PROJECT_ASSESSMENT.md`](PROJECT_ASSESSMENT.md) — pros/cons after all fixes
