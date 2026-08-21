# BlackWhip SentinelX — Full Repository Analysis

**Analyzed:** 2026-08-21 · **Branch:** `arena/01a0225f-blackwhip-sentinel` (commit `a54849f`, single squashed commit) · **Files:** 79 (excl. `.git`)

> **Update (same day):** Tier-4, Tier-3, Tier-2 and Tier-1 fixes have been applied on top of this analysis —
> alert dedup/aggregation and a
> SQLite-persisted live rules engine, structured JSON logging via `backend/logger.ts`, security
> hardening documented in `SECURITY.md` (secrets enforcement, real RBAC + user provisioning,
> CORS allowlist, short-lived SSE stream tokens, SQLite event persistence + search fallback,
> `/api/health`, TLS defaults), Tier-2 correctness fixes (threat-level computation, drift-free
> incident counter, hostname→agent-ID isolation, server-stamped audit, frontend merge-dedup),
> and Tier-1 blockers (configurable collector index `OPENSEARCH_ALERTS_INDEX`, telemetry
> `require()` fix, explicit dotenv loading, boot integration checks, throttled OpenSearch logs).
> **Final post-fix assessment: see `PROJECT_ASSESSMENT.md`.**
> **Update (same day, later):** per owner decision the platform is now **real-time only** —
> the SIMULATION-mode generator (`backend/simulator.ts`) was removed along with the mode
> toggle and `SIMULATE_ON_BOOT`. Telemetry comes exclusively from the OpenSearch collector
> and `POST /api/events/ingest`.

---

## 1. Executive Summary

**BlackWhip SentinelX** is an AI-powered SOC (Security Operations Center) incident-handling and attack-simulation platform. It is a single-page React 19 dashboard served by an Express + TypeScript backend, with:

- **Real-time telemetry ingestion** (Wazuh alerts via OpenSearch polling, plus an HTTP ingest endpoint)
- **Detection rules** (MITRE ATT&CK–mapped) that generate alerts and correlate them into incidents
- **"Paul" — a Gemini-powered AI** that triages incidents, writes analyses, and powers two copilots (incident-level NEXUS chat + global dashboard chat)
- **SOAR-style response actions**: host isolation through Wazuh Active Response, incident status workflow, autonomous-defense mode, audit logging
- **Persistence**: SQLite (`better-sqlite3`), with Firestore rules/config present but **not actually wired into the runtime**

The codebase works as a coherent demo/lab platform, but it carries significant **security gaps, frontend↔backend contract mismatches, dead code, and ~45 one-shot patch scripts** left at the repo root from iterative AI-assisted development. There is **no README, no tests, no CI**.

### Top findings (details in §7)

| # | Severity | Finding |
|---|----------|---------|
| 1 | 🔴 High | `firestore.rules` allows privilege escalation: any user can write their own `users/{uid}` doc and set `role: "ADMIN"`, bypassing `isAdmin()` |
| 2 | 🔴 High | Client-side `logAudit()` POSTs to `/api/audit`, but the server **removed** that POST endpoint → all client audit writes silently fail (BLOCK_IP etc. are never recorded) |
| 3 | 🔴 High | `RuleEngineering.tsx` reads fields (`id`, `name`, `conditionStr`, `tactic`, `technique`) that the server never sends (`rule_id`, `description`, `mitre_tactic`, …) → Rules tab renders `undefined` everywhere |
| 4 | 🟠 Medium | `.env` loading is accidental: only `backend/threatintel.ts` imports `dotenv/config`; `npm run dev` relies on that import side-effect — fragile and easy to break |
| 5 | 🟠 Medium | `/api/state/telemetry` uses `require('./opensearch.js')` inside an ESM module → `ReferenceError` swallowed by try/catch → **OpenSearch status always reports OFFLINE** |
| 6 | 🟠 Medium | `AuditLogsPanel.tsx` reads `log.userEmail` but the API returns `user_email` (snake_case) → user column always blank; `details` is double-`JSON.stringify`'d |
| 7 | 🟠 Medium | `IncidentView` isolation button: `isolationStatus` state is never updated (dead state) → no "Isolating…/success" feedback to the analyst |
| 8 | 🟠 Medium | `data/soc.db` (user password hashes + audit logs) is **not in `.gitignore`** |
| 9 | 🟡 Low | Real-looking Firebase client API key + project ID committed (`firebase-applet-config.json`); developer's personal email in `test-auth.cjs` |
| 10 | 🟡 Low | JWT in `localStorage` + token passed in SSE query string; `authFetch` treats 403 as "log out"; no token refresh |
| 11 | 🟡 Low | `types.ts`: duplicate `'RESOLVED'` in `IncidentStatus`; several statuses in the union are never produced by the backend |
| 12 | 🟡 Low | No README, no tests, no CI; ~45 root-level patch/fix scripts, several referencing files that no longer exist |

---

## 2. Architecture

```
 Browser (React 19 + Vite + Tailwind 4)
   │  REST (fetch/authFetch) + SSE (/api/stream, JWT in query string)
   ▼
 Express server (backend/server.ts, tsx)            ──► SQLite data/soc.db
   │                                                   (users, incidents, audit_logs)
   ├─ In-memory store (events/alerts/incidents, EventEmitter bus)
   ├─ Detection rules (rules.ts) → correlateAlert() → AI triage (ai.ts)
   ├─ Wazuh integration (wazuh.ts)  — agents, Active Response isolation
   ├─ OpenSearch (opensearch.ts)    — search + indexing
   ├─ Collector (services/wazuh-alert-collector.ts) — 5s poll of alerts index
   └─ Threat intel (threatintel.ts) — VirusTotal / OTX hash lookups
 Frontend: App shell → Dashboard / IncidentView / Sensors / Cases / Hunting /
           Rules / GlobalChat / AuditLogs / Login
 Firebase (applet config + firestore.rules) — declared, NOT used at runtime
```

**Data flow for an event:** HTTP ingest (shared key or JWT) or OpenSearch collector → `ingestEvent()` → normalize → `evaluateRules()` → alert → `correlateAlert()` → incident (SQLite + SSE broadcast) → async `runAIAnalysis()` ("Paul") enriches incident → optional autonomous isolation via Wazuh.

---

## 3. File-by-File Analysis

### 3.1 Backend (`backend/`)

#### `backend/server.ts` (646 lines) — the entire application server
Express app with Vite middleware in dev, static `dist/` in production. Key routes:

| Route | Auth | Notes |
|---|---|---|
| `GET /api/state` | JWT | system state (mode, EPS, endpoints…) |
| `POST /api/state/mode` / `defense` | analyst | mode toggle, autonomous defense; audited |
| `POST /api/incidents/:id/action` | analyst | UPDATE_STATUS, CASE_UPDATE, ISOLATE_HOST |
| `GET /api/wazuh/agents` | JWT | agent inventory |
| `POST /api/events/ingest` | ingest key **or** JWT | batch ingestion (forwarders) |
| `GET /api/state/telemetry` | JWT | Wazuh/OpenSearch status (see finding #5) |
| `POST /api/chat`, `/api/chat/global` | analyst | Paul copilots |
| `POST /api/login` | rate-limited | bcrypt + JWT (8h), audit row, anti-enumeration response |
| `GET /api/me`, `/api/audit`, `/api/events`, `/api/events/search`, `/api/rules`, `/api/alerts`, `/api/incidents(/:id)` | JWT | data endpoints |
| `GET /api/stream` | JWT **in query string** | SSE: new_event / new_alert / new_incident / incident_updated / state_update |

Notable issues:
- `requireAnalyst()` is a no-op beyond `requireAuth` (comment admits it: "just checks if authenticated").
- `require('./opensearch.js')` in the telemetry route breaks under ESM (finding #5).
- `store.state.activeIncidents++` in `correlateAlert` can drift vs. persisted counts; `loadIncidents()` recomputes on boot only.
- No dotenv import (finding #4 — works only via `threatintel.ts` side-effect).
- `process.on('uncaughtException')` logs but does not exit — process keeps running in a potentially bad state.
- Event history capped at 1000 for threshold matching; `window_seconds: 0` rules skip threshold logic.
- AI triage is fire-and-forget with `.catch()` — good, non-blocking.
- Autonomous defense: on HIGH/CRITICAL match, calls `isolateHost(hostname)` (hostname, not agent ID — resolved only by name match, see `wazuh.ts`) and appends SOAR-Bot case note.

#### `backend/db.ts` (83 lines) — SQLite bootstrap
- Creates `users`, `incidents`, `audit_logs` tables; idempotent `ALTER TABLE` migrations for later-added columns.
- Seeds/updates the first admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD` (bcrypt, cost 10). If env vars are unset, **no users exist → login impossible**.
- `incidents` table stores JSON blobs as TEXT (alerts, events, iocs, case_*).
- ⚠️ `data/soc.db` contains bcrypt hashes + audit logs and is not gitignored.
- Schema has an unused `timeline` column; no `affected_users` column (always rehydrated empty).

#### `backend/rules.ts` (54 lines) — static detection rules
4 rules: RDP brute-force (4625, 5×/5min), PowerShell download cradle (cmdline keywords), scheduled-task creation (4698), credential dumping (lsass/mimikatz). Each maps to MITRE tactic/technique and severity. Rules are **hard-coded**; the frontend "Rule Engineering" tab implies editable rules but there is no create/update endpoint (`/api/rules` is GET-only).

#### `backend/ai.ts` (160 lines) — "Paul" Gemini integration
- `getAI()` lazily builds `GoogleGenAI` from `GEMINI_API_KEY || PAUL_AI_API_KEY`; throws if unset.
- `runAIAnalysis()`: structured-JSON prompt (responseMimeType json) returning classification/severity/confidence/attack stage/evidence/MITRE candidates/recommended actions; includes a graceful fallback analysis object.
- `interrogateAI()` / `interrogateGlobalAI()`: grounded chat with strong anti-hallucination system prompts; maps history roles; global chat gets dashboard state + top-5 incidents.
- Model default `gemini-2.5-flash` (note: `test-gemini.ts` references a `gemini-3.5-flash` model that likely doesn't exist — the test would fail).

#### `backend/wazuh.ts` (74 lines) — Wazuh manager integration
- Basic-auth login → bearer token client; `getAgents()` maps `affected_items` to id/name/status/ip/os/version.
- `isolateHost()` posts Active Response `firewall-drop0`; swallows errors into `UNVERIFIED` status.
- ⚠️ When Wazuh is unreachable, `getAgents()` **always throws `"Wazuh Offline"`**, so the 2-second EPS interval's `catch(e){}` silently keeps `totalEndpoints` stale (0). The whole dashboard endpoint count goes blank when Wazuh is down — acceptable for a lab, worth knowing.

#### `backend/opensearch.ts` (65 lines) — OpenSearch client
- `getClient()` builds client from env (username/password optional-empty).
- `searchEvents()` — multi_match over Wazuh fields, filters by hostname/ip, sorted desc, 50 hits, index `wazuh-alerts-*`.
- `indexEvent()` — writes normalized events to index `wazuh-alerts-lab`; logs an error **per event** when OpenSearch is down (log spam in a busy lab).
- ⚠️ `ssl.rejectUnauthorized` is set from `OPENSEARCH_VERIFY_TLS` (default false) — fine for lab, bad for prod.

#### `backend/threatintel.ts` (40 lines) — IOC hash enrichment
- VirusTotal files lookup first (`x-apikey`), then AlienVault OTX fallback; `malicious = maliciousCount > 0` / `pulse_count > 0`.
- ⚠️ **Only file in the backend that imports `dotenv/config`** — the de-facto env loader for the whole app (fragile; see finding #4).
- Any failure → `{ malicious: false, source: 'UNKNOWN' }` — **fails open** (a malicious hash is treated benign when APIs are down).

#### `backend/services/wazuh-alert-collector.ts` (58 lines) — real-time alert poller
- Polls OpenSearch index **`wazuh-alerts-4.*`** every 5s (gte lastTimestamp, asc, size 100), dedupes via a 1000-entry `seenIds` set, forwards each hit to `ingestEvent()`.
- The index name looks like a placeholder from a specific lab; if the real index differs, the collector silently does nothing (its catch is an empty comment).
- `seenIds` eviction deletes 500 arbitrary entries (insertion order — approximately oldest).

---

### 3.2 Frontend (`frontend/`)

#### `frontend/index.html` — SPA shell (title/meta only, no favicon).

#### `frontend/src/main.tsx` — React 19 `createRoot` + `AuthProvider`.

#### `frontend/src/types.ts` (104 lines) — shared domain types
- `Severity`, `ThreatLevel`, `IncidentStatus`, `NormalizedEvent`, `Alert`, `Incident`, `AIAnalysis`, `ChatMessage`, `SystemState`.
- ⚠️ `IncidentStatus` contains `'RESOLVED'` **twice**; `'TRIAGE' | 'ERADICATION' | 'RECOVERY' | 'CONTAINMENT'` are in the union but the backend only ever sets `NEW` / `RESOLVED` / `CLOSED` / `CONTAINMENT` (auto-defense).
- ⚠️ Imported by the backend (`server.ts`) — frontend types are the shared contract; changes ripple both ways.

#### `frontend/src/utils.ts` (41 lines)
- `cn()` (clsx + tailwind-merge), `formatTime()`.
- `authFetch()`: attaches bearer token; on **401 or 403** it wipes credentials and `window.location.reload()`, returning a never-resolving Promise (callers hang until reload). On other non-OK it throws. 403-as-logout is aggressive UX (a legitimately locked-out analyst gets bounced to login).

#### `frontend/src/lib/AuthProvider.tsx` (67 lines)
- Stores `soc_token` + `soc_user` in localStorage; restores session on boot; `signIn()` POSTs `/api/login`.
- ⚠️ `JSON.parse(storedUser)` has no try/catch → a corrupted localStorage value crashes the app on load.
- `GUEST` role is a frontend-only concept — the server never issues it.

#### `frontend/src/lib/audit.ts` (12 lines)
- `logAudit()` POSTs to `/api/audit` — **the endpoint was removed server-side** (finding #2). Every call fails silently. `BLOCK_IP` has no server implementation at all (frontend-only button).

#### `frontend/src/App.tsx` (292 lines) — application shell
- Fetches initial state/events/incidents, opens SSE (`/api/stream?token=…`), wires `new_event/new_incident/incident_updated/state_update`.
- Main tabs: Dashboard / Workflows (placeholder text) / Sensors / Cases / Hunting / Rules.
- Live telemetry side panel (w-80) when on Dashboard.
- Settings/Profile modals are mostly **fake view-only UI** ("View-Only Mode Active"); Access Control / Agent Preferences / Paul Thresholds tabs are locked placeholders; "Confirm Disconnect" doesn't actually log out.
- Auto-defense toggle goes through `PermissionDialog` consent modal.
- ⚠️ `setEvents` from SSE + initial fetch can duplicate entries (no dedup keyed by `event_id`); events state is capped at 100.
- ⚠️ SSE token in query string leaks into proxy/access logs.

#### `frontend/src/components/TopBar.tsx` (290 lines)
- Branding, SYS.ONLINE/OFFLINE indicator, MODE toggle, tab nav, autonomous-defense toggle, notifications (static demo array), theme toggle, settings/profile dropdowns, logout.
- ⚠️ Layout is visibly malformed: the right-side group of elements sits *inside* the nav `<div>`; several classnames are duplicated (`z-50`/`z-40`, `hud-border` undefined); unused imports (`Play`, `Crosshair`, `Zap`).
- Notification bell/dropdowns are `group-hover` (no keyboard access).

#### `frontend/src/components/Dashboard.tsx` (190 lines)
- KPI cards (Threat Level / Active Incidents / High Alerts / Protected Endpoints) with glow styles; live EPS line chart (Recharts, 20-point rolling buffer); incident queue table with status filter chips.
- ⚠️ `threatLevel` is never updated anywhere in the backend (always `'LOW'`).
- `filteredIncidents` — "ACTIVE" = not RESOLVED (CLOSED incidents still show as active).

#### `frontend/src/components/IncidentView.tsx` (495 lines) — the richest component
- 6 tabs: SUMMARY (Paul analysis + evidence + MITRE map), GRAPH, TIMELINE, RESPONSE, REPORT, NEXUS (incident chat).
- Response tab: isolate host(s) via `/api/incidents/:id/action`, "Block IP" (client-only, no backend), "Mark as Resolved".
  - ⚠️ `isolationStatus` state is **never written** (finding #7) — the button just becomes disabled; also `isolationStatus[host]` never shows success.
  - ⚠️ Sends the entire `incident` object in the request body (unnecessary, inflates payloads).
- Report tab: generates a markdown DFIR report client-side and downloads it (nice touch).
- NEXUS chat: full history resent on every message (grows unbounded → token/context bloat).

#### `frontend/src/components/EventFeed.tsx` (45 lines)
- Simple telemetry feed: time, mode badge, severity color, event type, host, source, rule name.

#### `frontend/src/components/GlobalChat.tsx` (114 lines)
- Floating "Paul OS Copilot" chat; grounded via `/api/chat/global`; markdown rendering; same unbounded-history pattern.

#### `frontend/src/components/LoginView.tsx` (69 lines)
- Clean email/password form calling `signIn`; "Unauthorized Access Prohibited" branding.

#### `frontend/src/components/AttackGraph.tsx` (97 lines)
- ReactFlow graph: per-host nodes with per-event children chained by edges; severity-colored dashed borders; fitView. Solid, self-contained.

#### `frontend/src/components/AuditLogsPanel.tsx` (45 lines)
- Reads `/api/audit`.
- ⚠️ Field mismatch: server returns `user_email`/`user_id`; UI reads `log.userEmail` (blank); `details` is a JSON string that gets `JSON.stringify`'d again (finding #6).

#### `frontend/src/components/CaseManagement.tsx` (25 lines)
- Simple grid of incident cards → opens IncidentView. Fine; thin.

#### `frontend/src/components/ThreatHunting.tsx` (76 lines)
- Search box → `/api/events/search?q=` → table of raw events. Depends on OpenSearch being up (503 otherwise). No paging.

#### `frontend/src/components/RuleEngineering.tsx` (58 lines)
- Fetches `/api/rules`.
- 🔴 **Broken contract** (finding #3): renders `rule.id`, `rule.name`, `rule.conditionStr`, `rule.tactic`, `rule.technique` — server sends `rule_id`, `description`, `condition`, `mitre_tactic`, `mitre_technique`. Every card shows `undefined`. "New Rule" button is a no-op.

#### `frontend/src/components/PermissionDialog.tsx` (91 lines)
- Consent modal for Autonomous Defense (dramatic "Kernel Level / NT AUTHORITY\SYSTEM" copy). Pure UI — fine.

#### `frontend/src/sensors/SensorsDashboard.tsx` (152 lines)
- Fetches `/api/wazuh/agents`; KPI cards (total/active/disconnected/never-connected), OS breakdown (Windows/Linux/macOS), agent table with status pills.
- ⚠️ OS sniffing is case-insensitive `includes()` — a Windows agent named "MACBOOK" would be double-counted; negligible in practice.
- `frontend/src/sensors/SensorsDashboard.tsx.patch` — leftover diff from an earlier version (pre-`authFetch`, hardcoded "14,205 deployed" telemetry).

#### `frontend/src/index.css` (87 lines)
- Tailwind 4 import, `dark` custom variant, scanline animation, red-grid background, HUD panel styles, custom scrollbar, tooltip CSS vars.
- ⚠️ `hud-panel` uses `rgba(255,255,255,0.7)` light-mode bg with red accents — dark theme is clearly the intended look; light mode is half-hearted.

---

### 3.3 Applet scaffold (`app/` + `assets/`)

| File | Analysis |
|---|---|
| `app/applet/backend/wazuh.ts` | **Mock** Wazuh: 4 hardcoded agents; `isolateHost` just logs "success". Used by the AI-Studio applet variant, not by the real backend. |
| `app/applet/backend/threatintel.ts` | **Mock** threat intel: `hash.startsWith('bad')` → malicious. Lab stub. |
| `app/applet/frontend/src/lib/firebase.ts` | **Empty file (0 bytes)** — Firebase SDK integration never written. |
| `assets/.aistudio/.gitignore` | Contains `*` — ignores everything under `.aistudio`. |

---

### 3.4 Config & infra files

| File | Analysis |
|---|---|
| `package.json` | Name `"react-example"` (vestigial). `dev: tsx backend/server.ts`, `build` (vite + esbuild bundle of server), `lint: tsc --noEmit`. Deps: express 4, better-sqlite3, jsonwebtoken, bcryptjs, @google/genai, opensearch client, axios, react 19, recharts, reactflow, react-markdown, motion, uuid, dotenv, rate-limit, cors, tailwind 4. |
| `package-lock.json` | Lockfile, consistent with package.json (axios resolves to 1.19.0). |
| `tsconfig.json` | ES2022, bundler resolution, `noEmit`, `allowJs`, `jsx: react-jsx`, `@/* → ./*` alias, `types: [vite/client, node]`. **No `strict` mode** — lax type checking. |
| `vite.config.ts` | Root `frontend/`, outDir `dist/`, react + tailwind plugins, `@` alias → `frontend/src`. HMR & file watching disabled via `DISABLE_HMR` (for AI-studio agent editing). |
| `.env.example` | Documents all config: JWT_SECRET, ADMIN_EMAIL/PASSWORD, INGEST_API_KEY, WAZUH_*, OPENSEARCH_*, VIRUSTOTAL/OTX keys, GEMINI_API_KEY/PAUL_AI_API_KEY, GEMINI_MODEL. ⚠️ Defaults `change_me_now` / `your_jwt_secret_here` are exactly what you'd deploy accidentally. |
| `.gitignore` | ⚠️ Missing `data/` (SQLite DB with hashes + audit trail). |
| `firestore.rules` | Firestore security rules (see finding #1: self-role-escalation; also `events` write allowed for any authenticated user while the blueprint declares `writeAccess: false` for events). **Not enforced at runtime** — no Firestore usage in code. |
| `firebase-blueprint.json` | Schema blueprint for users/events/incidents/sensors collections (AI Studio tooling input). |
| `firebase-applet-config.json` | Real-looking Firebase project config (project `protean-crane-ft8c4`, API key, OAuth client id) — client-side key, low risk by itself, but it's committed project identity. |
| `metadata.json` | AI Studio applet metadata: "BlackWhip SentinelX — AI-Powered End-to-End SOC Incident Handling & Attack Simulation Platform", `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`. |
| `install_requirements/mac/install.sh` | Checks node ≥18, runs `npm install`, prints next steps. Fine. |
| `install_requirements/windows/install.bat` | Same for Windows with `pause`. Fine. |

---

### 3.5 Root-level scripts (~45 files)

These are **one-shot developer codemods** that were run during AI-assisted development and then left in the tree. None are invoked by `package.json`. They are not part of the runtime — they *edit* it.

**Server surgery (full-file templates):**
- `rewrite_server.cjs` (622 ln) — old full server source as a template string (pre-SSE, pre-collector).
- `fix_server.cjs` (394 ln) — another full server template that preserves the bottom half of the current file; basis of today's `server.ts`.

**Backend patches (`patch_*.cjs`):**
- `patch_server.cjs` — adds collector import + startup.
- `patch_fix.cjs` — adds `saveIncidentToDb`/upsert logic.
- `patch_db.cjs` — adds incident columns to CREATE TABLE.
- `patch_load.cjs` / `patch_loadIncidents.cjs` — DB→store hydration for incidents.
- `patch_auth.cjs`, `patch_auth401.cjs` — `/api/me`, 401 semantics (Firestore-era versions).
- `patch_audit.cjs` — Firestore-era audit route (now superseded by SQLite route).
- `patch_ai.cjs` — lazy `getAI()` refactor.
- `patch_agents.cjs`, `patch_isolate.cjs`, `patch_telemetry.cjs`, `patch_sse.cjs`, `patch_express_error.cjs`, `patch_collector.cjs` — agents route, hostname→agent-id isolation, telemetry status route, SSE auth, error middleware, collector dedupe.
- `patch.cjs` — **references `backend/firebase.ts`, which no longer exists** (dead script).

**Frontend patches:**
- `patch_authFetch.cjs` / `patch_authfetch_reload.cjs` / `patch_authfetch_ts.cjs` — evolution of `authFetch` (error throwing, reload-halt, typing).
- `patch_incident_view.cjs` — intended to add isolation status feedback — **its changes were never applied to the file** (hence finding #7).
- `fix-app-eventfeed.cjs`, `fix-app-login.cjs`, `fix-login-block.cjs` — App.tsx login/feed wiring.
- `fix-dashboard-chart.cjs`, `fix-dashboard-endpoints.cjs`, `fix-sim.cjs` (references deleted `frontend/src/workflows/WorkflowSimulator.tsx` — dead), `fix-server-endpoints.cjs`, `fix-server-eps.cjs`, `fix-server2.cjs`, `fix-db.cjs`, `fix-dotenv.cjs` (adds dotenv import — **not reflected in current server.ts**, evidence of drift), `fix-auth-backend.cjs` (2-step login design that was abandoned), `fix-fetch.cjs` (walks all TS files adding authFetch), `fix-ts.cjs`/`fix-all-ts.cjs` (TS workarounds: `as any`, `as const`, rule statuses), `fix_errors.cjs`, `fix-sensors.cjs` (full SensorsDashboard rewrite — applied), `fix-topbar.cjs`/`fix-topbar2.cjs`/`remove-inject.cjs` (removed a "WARGAMES INJECTOR" demo button from TopBar).

**Theming scripts:**
- `make_all_black.cjs`, `make_panels_black.cjs`, `make_red_black_orange.cjs`, `make_line_pattern.cjs`, `add_dark_mode.cjs`, `update_theme.cjs`, `update_theme.js` (identical purpose, two formats), `update_styles.sh` — sed/string replacements that produced the current black/red/orange HUD look. Repeated manual theming instead of Tailwind tokens — a maintainability smell.

**Scratch tests (not a test suite):**
- `test-api.cjs` (GETs `/api/incidents`), `test-json.cjs` (unfinished), `test-auth.cjs` (⚠️ hardcodes the author's personal email `shankarkadimi@gmail.com` and inserts a user directly into the DB), `test-auth.ts`/`test-auth2.ts` (Google Auth probe), `test-env.ts` (private-key cleanup helper), `test-gemini.ts` (probes `gemini-3.5-flash` — likely nonexistent model), `test-models.ts` (lists models).

---

## 4. End-to-End Scenario Walkthrough (verifies the happy path)

1. **Boot** — `npm run dev` → `db.ts` creates `data/soc.db`, seeds admin from env; `server.ts` loads incidents; collector starts polling OpenSearch.
2. **Login** — analyst submits credentials → bcrypt check → JWT (8h) → stored in localStorage.
3. **Telemetry** — SSE stream opens with token; state/events/incidents hydrate; EPS tick every 2s.
4. **Event** — forwarder POSTs `/api/events/ingest` with `X-Ingest-Key` (or collector polls) → normalized → rules engine → alert (SSE) → incident (SSE + SQLite) → Paul triage (async, enriches incident) → dashboard live-updates.
5. **Response** — analyst opens incident → Response tab → isolate host (Wazuh Active Response; audited) → mark resolved (audited).
6. **Autonomous mode** — if enabled, HIGH/CRITICAL alerts auto-isolate the host and log `AUTONOMOUS_DEFENSE_ISOLATE`.

---

## 5. What Works Well

- **Coherent real-time architecture**: in-memory store + EventEmitter + SSE is simple and effective for a lab.
- **Good AI grounding prompts** — Paul is explicitly told not to hallucinate and to state confidence; JSON-mode triage with a fallback is a solid pattern.
- **Decent security baseline in the API**: bcrypt, JWT expiry, login rate limiting, anti-enumeration responses, per-action server-side audit rows, ingest-key auth, removal of the unauthenticated audit POST.
- **Nice UX depth**: attack graph, DFIR markdown report export, NEXUS chat, consent dialog for dangerous actions.
- **SQLite upsert + JSON columns** keeps persistence trivial and dependency-light.

---

## 6. Recommended Next Steps (prioritized)

1. **Fix Firestore rules** if Firebase is ever used: role must come from a `request.auth.token.role` claim (custom claims), never from a user-writable doc; lock `events` writes to server-only.
2. **Restore or remove the audit POST path**: either re-add `POST /api/audit` (server-side validated) or delete `lib/audit.ts` and its call sites; fix `AuditLogsPanel` to read `user_email` and parse `details`.
3. **Fix `RuleEngineering.tsx`** to map the actual rule shape (or change `/api/rules` to emit the expected shape).
4. **Load `.env` explicitly**: `import 'dotenv/config'` at the top of `server.ts` (or `tsx --env-file=.env`).
5. **Replace `require('./opensearch.js')`** with the static import in the telemetry route.
6. **Apply the isolation-status feedback** (from `patch_incident_view.cjs`) so analysts see the action result.
7. **Add `data/` to `.gitignore`**; rotate the committed Firebase config values if the project matters.
8. **Delete or archive the root scripts** into `scripts/legacy/` or a git tag; add a README documenting setup, env vars, and architecture.
9. **Tighten RBAC**: make `requireAnalyst`/`requireAdmin` actually consult `req.user.role`, and add a real analyst-seeding path (currently only ADMIN is seeded).
10. **Add smoke tests** (the `test-*.cjs` files are a start) and wire `npm run lint` into CI.

---

## 7. Appendix — Complete File Inventory (79 files)

| File | Role | Status |
|---|---|---|
| `.env.example` | env template | ⚠️ weak defaults |
| `.gitignore` | ignores | ⚠️ missing `data/` |
| `package.json` / `package-lock.json` | deps/scripts | ok |
| `tsconfig.json`, `vite.config.ts` | build | ok (no strict) |
| `metadata.json` | AI Studio metadata | ok |
| `firebase-applet-config.json` | Firebase client config | ⚠️ committed project identity |
| `firebase-blueprint.json` | Firestore blueprint | ok |
| `firestore.rules` | Firestore rules | 🔴 escalation |
| `backend/server.ts`, `db.ts`, `ai.ts`, `rules.ts`, `wazuh.ts`, `opensearch.ts`, `threatintel.ts`, `services/wazuh-alert-collector.ts` | runtime backend | multiple findings above |
| `frontend/index.html`, `src/main.tsx`, `App.tsx`, `types.ts`, `utils.ts`, `index.css` | shell | ok / small issues |
| `frontend/src/lib/AuthProvider.tsx`, `audit.ts` | auth + audit | 🔴 audit dead-end |
| `frontend/src/components/*` (12 files) | UI | RuleEngineering 🔴, AuditLogsPanel 🟠, IncidentView 🟠, TopBar 🟠 (layout), rest ok |
| `frontend/src/sensors/SensorsDashboard.tsx` (+`.patch`) | sensor UI | ok / leftover patch |
| `app/applet/backend/*`, `app/applet/frontend/src/lib/firebase.ts` | AI-Studio applet stubs | mock/empty |
| `assets/.aistudio/.gitignore` | tooling | ok |
| `install_requirements/mac/install.sh`, `windows/install.bat` | setup | ok |
| `rewrite_server.cjs`, `fix_server.cjs`, `fix-*.cjs` (15), `patch*.cjs` (20), `make_*.cjs` (4), `add_dark_mode.cjs`, `update_theme.cjs/.js`, `update_styles.sh`, `remove-inject.cjs` | dev codemods | 🟡 cruft, some dead refs |
| `test-api.cjs`, `test-auth.cjs`, `test-auth.ts`, `test-auth2.ts`, `test-env.ts`, `test-gemini.ts`, `test-json.cjs`, `test-models.ts` | scratch tests | 🟡 not a suite; personal email hardcoded |

---

*Analysis generated from a full read of every tracked file in the repository (commit `a54849f`).*
