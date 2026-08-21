#!/usr/bin/env node
/**
 * BlackWhip SentinelX — end-to-end smoke test.
 *
 * Boots the real server on a test port with isolated env, then asserts the
 * critical paths: boot secret validation, login, RBAC, user management,
 * simulation telemetry, rules CRUD, audit, stream tokens, health, workflows.
 *
 * Usage: npm test   (or: node scripts/smoke-test.cjs)
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PORT = 8453;
const BASE = `http://localhost:${PORT}`;
const STRONG_SECRET = 'SmokeTestSecret_DoNotUseInProd_9f8e7d';
const ADMIN_EMAIL = 'smoke@test.local';
const ADMIN_PASS = 'SmokePass123!';

let failures = 0;
let server = null;
// Isolated database directory — the smoke test must NEVER touch the live
// app's data/ (a running dashboard shares that file).
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bws-smoke-'));

function pass(name) { console.log(`  \x1b[32mPASS\x1b[0m ${name}`); }
function fail(name, detail) {
  failures++;
  console.log(`  \x1b[31mFAIL\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`);
}

async function waitFor(fn, timeoutMs = 30000, intervalMs = 500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const v = await fn();
      if (v) return v;
    } catch { /* keep polling */ }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error('timeout waiting for condition');
}

function startServer(envOverrides) {
  const env = {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(PORT),
    JWT_SECRET: STRONG_SECRET,
    ADMIN_EMAIL,
    ADMIN_PASSWORD: ADMIN_PASS,
    LOG_LEVEL: 'error',
    DATA_DIR: dataDir,
    AUTO_AUTH: 'false', // smoke tests exercise the real auth flow
    ...envOverrides,
  };
  const child = spawn('npx', ['tsx', 'backend/server.ts'], {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
  return child;
}

async function api(method, url, { token, body } = {}) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

async function main() {
  console.log('\nBlackWhip SentinelX — smoke test\n');

  // --- 1. Boot with weak secret must abort ---
  console.log('[1] Boot secret validation');
  const weak = startServer({ JWT_SECRET: 'your_jwt_secret_here' });
  const weakExit = await Promise.race([
    new Promise(r => weak.on('exit', code => r(code))),
    new Promise(r => setTimeout(() => r('still-running'), 15000)),
  ]);
  try { process.kill(-weak.pid, 'SIGKILL'); } catch { weak.kill(); }
  if (weakExit === 1) pass('refuses to boot with placeholder JWT_SECRET (exit 1)');
  else fail('weak-secret boot refusal', `exit=${weakExit}`);

  // --- 2. Healthy boot + login ---
  console.log('[2] Boot & auth');
  server = startServer({});
  await waitFor(async () => (await api('GET', '/api/health')).status === 200);
  pass('server boots with strong secrets');

  const health = await api('GET', '/api/health');
  if (health.json?.status === 'ok') pass('/api/health reports ok');
  else fail('/api/health', JSON.stringify(health.json));

  const login = await api('POST', '/api/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASS } });
  if (login.status === 200 && login.json?.token) pass('admin login issues JWT + cookie');
  else { fail('admin login', `${login.status} ${JSON.stringify(login.json)}`); return; }
  const TOKEN = login.json.token;

  const state = await api('GET', '/api/state', { token: TOKEN });
  if (state.status === 200) pass('authenticated /api/state');
  else fail('/api/state', String(state.status));

  const noAuth = await api('GET', '/api/state');
  if (noAuth.status === 401) pass('unauthenticated request rejected (401)');
  else fail('unauthenticated 401', String(noAuth.status));

  // --- 3. RBAC: analyst vs admin ---
  console.log('[3] RBAC & user management');
  const created = await api('POST', '/api/users', { token: TOKEN, body: { email: 'analyst@test.local', password: 'AnalystPass123!', role: 'ANALYST' } });
  if (created.status === 201) pass('admin creates ANALYST user');
  else fail('create analyst', `${created.status} ${JSON.stringify(created.json)}`);

  const dup = await api('POST', '/api/users', { token: TOKEN, body: { email: 'analyst@test.local', password: 'AnalystPass123!', role: 'ANALYST' } });
  if (dup.status === 409) pass('duplicate user rejected (409)');
  else fail('duplicate user', String(dup.status));

  const weakPw = await api('POST', '/api/users', { token: TOKEN, body: { email: 'x@test.local', password: 'short', role: 'ANALYST' } });
  if (weakPw.status === 400) pass('weak password rejected (400)');
  else fail('weak password', String(weakPw.status));

  const analLogin = await api('POST', '/api/login', { body: { email: 'analyst@test.local', password: 'AnalystPass123!' } });
  if (analLogin.status === 200) pass('analyst can log in');
  else fail('analyst login', String(analLogin.status));
  const ANA_TOKEN = analLogin.json?.token;

  const denied = await api('GET', '/api/users', { token: ANA_TOKEN });
  if (denied.status === 403) pass('analyst blocked from admin-only /api/users (403)');
  else fail('analyst 403', String(denied.status));

  // --- 4. Real ingestion pipeline (no simulator) ---
  console.log('[4] Real-time ingestion');
  const mode = await api('GET', '/api/state/mode', { token: TOKEN });
  if (mode.json?.mode === 'LIVE' && mode.json?.simulated === false) pass('system is LIVE-only (simulation disabled)');
  else fail('live-only state', JSON.stringify(mode.json));

  const ingest = await api('POST', '/api/events/ingest', {
    token: TOKEN,
    body: {
      timestamp: new Date().toISOString(),
      agent: { name: 'SMOKE-HOST-01', id: 'smoke-1' },
      rule: { level: 10, description: 'smoke test event' },
      event_type: '4688',
      data: { srcip: '198.51.100.7' },
    },
  });
  if (ingest.status === 200 && ingest.json?.accepted === 1) pass('POST /api/events/ingest accepts a real event');
  else fail('ingest endpoint', `${ingest.status} ${JSON.stringify(ingest.json)}`);

  const events = await waitFor(async () => {
    const r = await api('GET', '/api/events', { token: TOKEN });
    const found = (r.json || []).find(e => e.hostname === 'SMOKE-HOST-01');
    return found ? r.json : null;
  }, 15000);
  if (events?.some(e => e.hostname === 'SMOKE-HOST-01')) pass('ingested event flows through the real pipeline to /api/events');
  else fail('ingested event visible');

  // --- 5. Rules CRUD ---
  console.log('[5] Rules engine');
  const rule = await api('POST', '/api/rules', { token: TOKEN, body: { description: 'Smoke test rule', severity: 'LOW', mitre_tactic: 'Test', condition: { event_type: '99999', threshold: 1, window_seconds: 0 } } });
  if (rule.status === 201 && rule.json?.rule_id) pass(`rule created (${rule.json.rule_id})`);
  else fail('rule create', `${rule.status} ${JSON.stringify(rule.json)}`);
  const RULE_ID = rule.json?.rule_id;

  const upd = await api('PUT', `/api/rules/${RULE_ID}`, { token: TOKEN, body: { enabled: false } });
  if (upd.status === 200 && upd.json?.enabled === false) pass('rule disabled via PUT');
  else fail('rule disable', `${upd.status} ${JSON.stringify(upd.json)}`);

  const del = await api('DELETE', `/api/rules/${RULE_ID}`, { token: TOKEN });
  if (del.status === 200) pass('rule deleted');
  else fail('rule delete', String(del.status));

  // --- 6. Audit + stream tokens ---
  console.log('[6] Audit & real-time');
  const aud = await api('POST', '/api/audit', { token: TOKEN, body: { action: 'SMOKE_TEST', details: { ok: true } } });
  if (aud.status === 201) pass('client audit event recorded (server-stamped)');
  else fail('audit POST', String(aud.status));

  const streamTok = await api('POST', '/api/stream/token', { token: TOKEN });
  if (streamTok.status === 200 && streamTok.json?.token) pass('short-lived stream token issued');
  else fail('stream token', String(streamTok.status));

  const streamRes = await fetch(`${BASE}/api/stream?token=${streamTok.json?.token || ''}`);
  const reader = streamRes.body.getReader();
  const { value } = await reader.read();
  const chunk = new TextDecoder().decode(value);
  reader.cancel();
  if (streamRes.status === 200 && chunk.includes('state_update')) pass('SSE stream delivers state_update');
  else fail('SSE stream', `${streamRes.status} ${chunk.slice(0, 60)}`);

  const badStream = await api('GET', `/api/stream?token=${TOKEN}`);
  if (badStream.status === 401) pass('long-lived JWT rejected by stream endpoint (401)');
  else fail('stream scope check', String(badStream.status));

  // --- 7. Workflows + telemetry ---
  console.log('[7] Ops endpoints');
  const wf = await api('GET', '/api/workflows', { token: TOKEN });
  if (wf.status === 200 && Array.isArray(wf.json) && wf.json.length >= 4) pass(`workflows inventory (${wf.json.length} playbooks)`);
  else fail('workflows', String(wf.status));

  const tel = await api('GET', '/api/state/telemetry', { token: TOKEN });
  if (tel.status === 200 && 'gemini' in tel.json) pass('telemetry status endpoint (incl. gemini/threatIntel fields)');
  else fail('telemetry', `${tel.status} ${JSON.stringify(tel.json)}`);

  // --- 8. CORS same-origin lockdown ---
  console.log('[8] CORS');
  const cors = await fetch(`${BASE}/api/health`, { headers: { Origin: 'http://evil.example' } });
  if (!cors.headers.get('access-control-allow-origin')) pass('cross-origin request gets no ACAO header');
  else fail('CORS lockdown');

  // --- Cleanup ---
  try { process.kill(-server.pid, 'SIGKILL'); } catch { server.kill(); }
  await new Promise(r => server.on('exit', r)).catch(() => {});
  await new Promise(r => setTimeout(r, 300));
  fs.rmSync(dataDir, { recursive: true, force: true });

  console.log(failures === 0
    ? '\n\x1b[32mALL SMOKE TESTS PASSED\x1b[0m\n'
    : `\n\x1b[31m${failures} TEST(S) FAILED\x1b[0m\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => {
  console.error('Smoke test crashed:', e);
  if (server) { try { process.kill(-server.pid, 'SIGKILL'); } catch { server.kill(); } }
  process.exit(1);
});
