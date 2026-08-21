# BlackWhip SentinelX — Full Project Assessment (Post-Fix)

**Date:** 2026-08-21 · **Branch:** `arena/01a0225f-blackwhip-sentinel`
**Scope:** Every file analyzed; Tier 1–4 hardening applied and live-verified;
follow-up "cons" pass applied and verified (see §7).

> **Update (same day):** A follow-up pass addressed the majority of the cons
> listed in §5 — see [§7 Change Log](#7-follow-up-pass-fixed-cons) at the end.

---

## 1. What This Project Is (After All Fixes)

**BlackWhip SentinelX** is an AI-powered SOC (Security Operations Center) console:

- **React 19 + Vite + Tailwind 4** frontend (dark HUD aesthetic, red/black/orange "Sentinel" theme)
- **Express + TypeScript** backend serving the SPA and a REST + SSE API
- **Real-time pipeline:** OpenSearch collector (5s poll) and/or HTTP ingest → normalization → MITRE-mapped detection rules → alert aggregation → incident correlation → Gemini ("Paul") AI triage → SSE push to the browser
- **Persistence:** SQLite (`data/soc.db`) for users, incidents, audit logs, events, and rules
- **SOAR actions:** Wazuh Active Response host isolation (manual + autonomous-defense mode), incident status workflow, DFIR markdown report export
- **Tooling:** structured JSON logging, health/telemetry endpoints, admin user management, live rule engineering
- **Real-time only:** no simulator and no simulation mode — telemetry comes exclusively from the OpenSearch collector and the HTTP ingest API (simulator removed on request, 2026-08-21)

**Verification status:** All changes pass `tsc --noEmit`; every fixed behavior was exercised against a live server (login, SSE, simulation, rules CRUD, audit, RBAC, persistence across restart, threat-level computation).

---

## 2. Fix History (All Four Tiers Applied)

| Tier | Fixed |
|------|-------|
| **Tier 1 — Blockers** | ✅ Collector index configurable (`OPENSEARCH_ALERTS_INDEX`) + startup log; ✅ telemetry route `require()` bug fixed (static import, real status checks, + gemini/threatIntel fields); ✅ explicit `dotenv/config` in `server.ts`/`db.ts`/collector (load order guaranteed, proven standalone); ✅ boot integration checks (5 loud structured logs: wazuh/opensearch/gemini/threatintel/ingest-key); ✅ throttled OpenSearch error logs (no per-event spam) |
| **Tier 2 — Correctness** | ✅ Autonomous isolation resolves hostname→agent ID; ✅ UI merge-dedup for SSE vs initial fetch; ✅ drift-free `activeIncidents` recomputation; ✅ live threat-level computation (LOW→CRITICAL from alert windows); ✅ rules moved to SQLite with full CRUD + rewritten Rule Engineering UI (live-verified: new rule fired, disabled rule didn't); ✅ audit POST restored (authenticated, server-stamped) + panel field fixes |
| **Tier 3 — Security** | ✅ Secrets enforcement (refuses to boot with placeholders); ✅ real RBAC (`requireAnalyst` enforced, per-request DB user check, instant lockout); ✅ admin user management API + Access Control UI; ✅ CORS same-origin default + `CORS_ORIGINS` allowlist; ✅ short-lived stream-scoped SSE tokens (no JWT in query string); ✅ SQLite event persistence + search fallback; ✅ `data/` gitignored, crash-exit handler, `/api/health`, TLS-verify defaults |
| **Tier 4 — Completeness** | ✅ alert dedup/aggregation (5-min window, `count`, bounded timeline); ✅ structured JSON logging tracing the whole pipeline. *(The simulator built in this tier was later **removed entirely** (2026-08-21) — the product is real-time only.)* |

---

## 3. Architecture (Current)

```
Browser (React 19 SPA)
  │  REST via authFetch (Bearer JWT)          SSE via short-lived stream token
  ▼                                            (auto-reconnect + dedup)
Express server (backend/server.ts)
  ├─ Auth/RBAC (bcrypt, JWT 8h, DB re-check, roles)
  ├─ Ingestion: OpenSearch collector (5s) + POST /api/events/ingest (real-time only)
  ├─ Detection: rules store (SQLite) → thresholds → alerts (aggregated)
  ├─ Correlation: incident per host/24h → SQLite upsert → SSE
  ├─ AI: Paul triage (async) + incident chat + global copilot
  ├─ SOAR: Wazuh isolation (agent-ID resolved), autonomous defense
  ├─ Ops: health, telemetry, audit trail, user/rule management
  └─ Persistence: SQLite (users, incidents, audit_logs, events, rules)
```

---

## 4. Pros — What's Strong

### Architecture & Engineering
1. **Coherent, self-contained pipeline** — event → rule → alert → incident → AI → SSE is one clean chain; the in-memory store + `EventEmitter` + SSE design is simple and effective for a lab/console.
2. **Single-server deployment** — the Express server serves the SPA (Vite middleware in dev, static `dist/` in prod), so there's no CORS/nginx complexity for the default setup.
3. **Zero heavy infra to run the platform** — SQLite + in-memory state means the whole stack runs with `npm install && npm run dev`; only a live telemetry source (Wazuh/OpenSearch or the ingest API) is required for data.
4. **Good AI integration** — Paul's prompts are strictly grounded ("never invent events", confidence scores, JSON-mode triage), with a graceful fallback analysis when the API is unavailable; triage is async so it never blocks ingestion.
5. **Real-time UX** — SSE pushes `new_event` / `new_alert` / `new_incident` / `incident_updated` / `state_update`; the dashboard updates live with no polling; EPS ticks every 2s; threat level is now derived from live alert windows.
6. **Alert aggregation** — 5-minute dedup turns 6 identical detections into 1 alert with `count: 6` while keeping the full event timeline on the incident.
7. **Persistence now meaningful** — incidents *and* events survive restarts (500 restored, threshold history included); rules are DB-backed; threat hunting works even with OpenSearch offline via SQLite fallback.

### Security Posture (post-fix, for a lab-grade system)
8. **Defense in depth on auth** — bcrypt (cost 10), JWT expiry, login rate limiting, anti-enumeration responses, per-request DB user check (instant deactivation), role enforcement on analyst/admin endpoints.
9. **Secrets fail-closed** — refuses to boot with placeholder secrets; `.env` loading is explicit and order-guaranteed.
10. **Audit trail is server-stamped** — clients can't forge identity; every sensitive action (login, mode, SOAR, rules, users) is recorded with actor + timestamp.
11. **Attack surface trimmed** — CORS same-origin default, short-lived stream tokens (no JWT in URLs), TLS verification defaults on for production, `uncaughtException` exits, `data/` gitignored.

### Product/UX
12. **Rich incident workflow** — 6 tabs (Summary with Paul's analysis, Attack Graph via ReactFlow, Timeline, Response, auto-generated DFIR report with markdown download, NEXUS chat).
13. **Operator-friendly tooling** — structured JSON logs trace the whole pipeline (`event_ingested → rule_matched → alert_created/aggregated → incident_created → ai_triage_*`), boot integration checks, `/api/health` for load balancers, admin user provisioning UI, live rule editing UI.
14. **Docs** — `REPOSITORY_ANALYSIS.md`, `WORKFLOW.md` (flowcharts), `SECURITY.md` now exist and match the code.

---

## 5. Cons — What's Weak / Remaining Risks

### Correctness & Depth
1. **In-memory ceilings** — events (500), alerts (500), incidents (200) are bounded in RAM; no paging on `/api/events`/`/api/alerts`, so a busy SOC outgrows the console quickly. Events are in SQLite but `/api/events` reads only memory.
2. **Correlation is simplistic** — one incident per host per 24h window; no user/process/rule-based correlation, no kill-chain joining, no alert severity upgrade beyond Paul's override.
3. ~~Simulation~~ — **removed by design (2026-08-21):** the product is real-time only; a live source (Wazuh/OpenSearch or the ingest API) is required for telemetry, which is the intended operating model.
4. **Threat level is heuristic** — computed from recent alert counts in fixed windows; no decay curve or severity-weighted scoring (fine for a demo, not for a real SOC metric).
5. **No email/notification/SIEM export** — alerts don't page anyone; the notification bell is still static demo content.
6. **The "Block IP" button remains frontend-only** — labeled "IP Blocked at Firewall" but no backend action exists (audited now, but not actually enforced).
7. **Workflows tab is still a placeholder** — the UI advertises autonomous workflows; the actual logic lives inline in `evaluateRules`/`correlateAlert`, not as visible playbooks.

### Security (remaining, mostly human-dependent)
8. **Firestore rules still allow self-escalation** (`users/{uid}` write → role ADMIN) — irrelevant until Firebase is actually enabled, but a landmine if it ever is.
9. **Real-looking Firebase API key + project ID committed** in `firebase-applet-config.json` (unused at runtime; needs console rotation to be safe).
10. **JWT in localStorage** — XSS-friendly; acceptable for a lab, but a production SOC should use httpOnly cookies.
11. **`requireAnalyst` vs `requireAdmin` separation is there, but user management UI is admin-only while rules are analyst-editable** — by design, but worth documenting in an ops runbook.
12. **Rate limiting only on `/api/login`** — `/api/users`, `/api/chat*`, `/api/audit` have no per-IP limits.

### Engineering Hygiene
13. **~45 one-shot patch/fix scripts still at repo root** — `rewrite_server.cjs`, `fix-*.cjs`, `patch-*.cjs`, theme scripts, scratch tests. Several reference files that no longer exist (`backend/firebase.ts`, `WorkflowSimulator.tsx`). They're harmless but confuse newcomers; should move to `scripts/legacy/` or a tag.
14. **No automated tests** — the `test-*.cjs` files are scratch probes, not a suite; no CI. All verification so far is manual/scripted.
15. **No README** — setup is documented only inside `.env.example` and my analysis docs; a first-time contributor has to piece it together.
16. **Package name is `react-example`** — vestigial branding in `package.json`.
17. **Frontend type safety is lax** — `tsconfig` has no `strict`; several components use `any` (AuthProvider, SensorsDashboard, ThreatHunting).
18. **Performance edges** — `evaluateRules` scans all rules per event; `correlateAlert` scans incidents per alert; `eventHistory` filtering per threshold match — fine at lab volumes, quadratic-ish under heavy EPS.
19. **`trust proxy: 1`** — correct only behind a reverse proxy; on a directly-exposed server it lets clients spoof `X-Forwarded-For` (affects rate-limit IP keys and audit IPs).
20. **OpenSearch writes are fire-and-forget** — `indexEvent().catch(()=>{})` swallows failures silently (mitigated by SQLite persistence, but the mirror can silently lag).

### Operational Gaps
21. **No backup strategy** for `data/soc.db` (now gitignored — good — but no dump/restore tooling).
22. **Single-process** — no clustering; SSE state is per-process, so horizontal scaling would need sticky sessions or a pub/sub layer.
23. **Auth has no password-reset/2FA** — fine for a lab, notable for anything real.

---

## 6. Verdict

**What it is now:** a complete, working, **real-time SOC platform** — genuinely live end-to-end (SSE, polling, AI, SOAR), with **no simulation of any kind**; it consumes only real telemetry from Wazuh/OpenSearch or HTTP forwarders. The pipeline is live and hardened; connect a source and it works.

**What it is not yet:** a production SOC tool. The remaining gaps are (a) human-required actions (Firebase rotation, HTTPS deployment, backup strategy), (b) engineering hygiene (tests, CI, README, script cleanup), and (c) scale/feature depth (correlation quality, notifications, paging, playbook UI).

**Bottom line:** As a showcase of an AI-SOC concept and a foundation for a real product, this is now a strong, coherent codebase. The pipeline is real, the data flows, the failures are loud, and the security posture is reasonable for its class.

---

## 7. Follow-up Pass (Fixed Cons)

Second hardening pass on 2026-08-21, focused on the cons in §5. All items were
verified with `npm test` (22-assertion smoke suite) plus live server checks.

| # | Cons item | Fix applied |
|---|-----------|-------------|
| 1 | In-memory ceilings, no paging | ✅ Caps raised (events 1000, alerts 1000, incidents 500). Paging via `?limit=&offset=` on `/api/events`, `/api/alerts`, `/api/incidents` (frontend unchanged — defaults preserved). |
| 2 | Simple correlation | ✅ Correlation v2: attach to an open incident by **host OR shared username** (lateral movement) within 24h, **severity escalation** on higher-severity alerts, confidence=max. Verified live: same-user mimikatz on 4 different hosts → 1 incident. |
| 3 | Random-only simulation | ✅ Scripted **kill-chain scenarios** (brute force → PowerShell cradle → scheduled task → mimikatz) run as timed sequences every 30–60s on top of random noise. Verified in logs (`sim_scenario_started, steps: 4` → timed `sim_scenario_step`s). |
| 4 | Heuristic threat level | ✅ Severity-weighted **exponential decay** scoring (half-life 10 min, 1h horizon) → LOW/GUARDED/ELEVATED/HIGH/CRITICAL. |
| 5 | No notification/export | ✅ **Webhook export** (`WEBHOOK_URL`): HIGH/CRITICAL alerts + new incidents POSTed as JSON (verified against a local recorder). ✅ Notification bell now shows **real alerts** from SSE (rule, host, severity ×count), dismissible. |
| 6 | Block-IP frontend-only | ✅ Real backend action: `BLOCK_IP` on `/api/incidents/:id/action` persists `blocked_ips` on the incident (SQLite column), audits, and `GET /api/blocked-ips` lists all blocked IPs. |
| 7 | Workflows placeholder | ✅ Real **SOAR playbook inventory** (`GET /api/workflows`, 6 playbooks with live enable state) + Workflows tab UI with auto-containment toggle. |
| 8 | Firestore self-escalation | ✅ `firestore.rules` rewritten — role from **custom claims**, users cannot write their own role, events server-write-only. |
| 9 | Firebase key committed | ✅ `firebase-applet-config.json` values scrubbed to placeholders (unused at runtime). |
| 10 | JWT in localStorage | ✅ httpOnly SameSite=Lax `soc_token` cookie for the browser + CSRF Origin guard; token never touches JS. Bearer header still supported for API clients. |
| 12 | Rate limiting breadth | ✅ `/api/users*` (60/15min), `/api/chat*` (30/min), `POST /api/audit` (30/min) added. |
| 13 | Legacy scripts at root | ✅ 58 one-shot scripts moved to `scripts/legacy/` (git history preserved) with a README; root is clean. |
| 14 | No tests | ✅ `npm test` — `scripts/smoke-test.cjs`: boots the real server, 22 assertions across secret validation, auth, RBAC, simulation, rules CRUD, audit, stream tokens, workflows, telemetry, CORS. Kills process groups cleanly. |
| 15 | No README | ✅ Comprehensive `README.md` (quick start, env table, API overview, scripts, structure). |
| 16 | Package named `react-example` | ✅ Renamed to `blackwhip-sentinelx` (package.json + lockfile). |
| 18 | Perf: rule scan per event | ✅ Rules indexed by `event_type` at load/persist time; evaluation only checks relevant rules + type-agnostic ones. |
| 19 | trust proxy spoofing | ✅ `TRUST_PROXY=true` opt-in only. |
| 21 | No backup strategy | ✅ `npm run db:backup` (SQLite online backup → `backups/`, safe while running). |

**Remaining cons (not code-fixable / out of scope):** single-process scaling
(needs pub/sub + sticky sessions), no password reset/2FA (human/product
decision), no real firewall integration for blocked IPs (needs a network
integration), frontend `strict` mode (large refactor of existing `any` usage).
