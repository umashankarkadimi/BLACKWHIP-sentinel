// Load environment variables FIRST — before any module reads process.env.
// (dotenv/config is idempotent: real env vars always win over .env values.)
import 'dotenv/config';

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import cookieParser from "cookie-parser";
import { v4 as uuidv4 } from "uuid";
import { EventEmitter } from "events";
import { NormalizedEvent, Alert, Incident, SystemState, Severity } from "../frontend/src/types.js";
import { detectionRules } from "./rules.js";
import { lookupHash } from "./threatintel.js";
import { getAgents, isolateHost } from "./wazuh.js";
import { getClient, indexEvent, searchEvents } from "./opensearch.js";
import { db } from "./db.js";
import { startCollector } from "./services/wazuh-alert-collector.js";
import { interrogateAI, interrogateGlobalAI, runAIAnalysis } from "./ai.js";
import { sendWebhook, webhookConfigured } from "./webhook.js";
import { logger } from "./logger.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";

const app = express();
// Only trust X-Forwarded-For when explicitly behind a reverse proxy
// (TRUST_PROXY=true). On a directly-exposed server this prevents clients
// from spoofing their IP (affects rate limiting + audit IPs).
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// CORS: same-origin by default (the dashboard is served by this same server).
// To allow a separately-hosted dashboard, set CORS_ORIGINS to a comma-separated
// allowlist, e.g. CORS_ORIGINS=https://soc.example.com,https://soc.internal
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
if (corsOrigins.length > 0) {
  app.use(cors({ origin: corsOrigins, credentials: true }));
}
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// CSRF guard for COOKIE-authenticated state changes only: browsers send an
// Origin header on cross-site POST/PUT/DELETE; if it doesn't match the host
// the request is rejected. Requests carrying an Authorization: Bearer header
// are NOT CSRF-able (the token is never auto-attached by the browser), so they
// pass through untouched — this also keeps legitimate proxy-rewritten
// dashboard requests from ever being rejected. Proxies that rewrite Host but
// preserve X-Forwarded-Host are tolerated.
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const hasBearer = (req.headers.authorization || '').startsWith('Bearer ');
    const hasSessionCookie = !!(req as any).cookies?.soc_token;
    const origin = req.headers.origin;
    // CSRF only matters when a cookie session is actually being used: with no
    // cookie there is no session to hijack, so login/API requests from any
    // origin pass. This also keeps embedded previews working where the proxy
    // rewrites the Host header.
    if (origin && !hasBearer && hasSessionCookie) {
      const seenHosts = [req.headers.host, req.headers['x-forwarded-host']]
        .filter(Boolean)
        .map(h => String(h));
      try {
        const originHost = new URL(origin).host;
        if (!seenHosts.includes(originHost)) {
          logger.warn('csrf_rejected', { origin: originHost, hosts: seenHosts });
          return res.status(403).json({ error: "Cross-origin request rejected" });
        }
      } catch {
        return res.status(400).end();
      }
    }
  }
  next();
});

// Login rate limit — generous enough for demos/embedding, still protects the
// endpoint. Override with LOGIN_RATE_LIMIT_MAX.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '50', 10),
  standardHeaders: true,
  legacyHeaders: false,
});
const adminLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60 });
const chatLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });
const auditLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });
const PORT = parseInt(process.env.PORT || "3000", 10);
const eventBus = new EventEmitter();

process.on('unhandledRejection', (reason) => { logger.error('unhandled_rejection', { reason: String(reason) }); });
process.on('uncaughtException', (err) => {
  logger.error('uncaught_exception', { error: err.message, stack: err.stack });
  // Do not keep serving from a possibly-corrupt process state.
  process.exit(1);
});
eventBus.setMaxListeners(100);

// Refuse to boot with missing or placeholder secrets — a SOC console that
// starts with known credentials is worse than one that does not start.
function validateSecrets() {
  const WEAK = new Set(['your_jwt_secret_here', 'change_me_now', 'secret', 'password', 'changeme', 'admin']);
  const jwtSecret = process.env.JWT_SECRET;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!jwtSecret || WEAK.has(jwtSecret)) {
    logger.error('boot_aborted_invalid_jwt_secret', { hint: 'Set a strong JWT_SECRET (e.g. openssl rand -hex 32)' });
    process.exit(1);
  }
  if (!adminPassword || WEAK.has(adminPassword)) {
    logger.error('boot_aborted_invalid_admin_password', { hint: 'Set a strong ADMIN_PASSWORD (min 8 chars) before boot' });
    process.exit(1);
  }
}
validateSecrets();

let store = {
  events: [] as NormalizedEvent[],
  alerts: [] as Alert[],
  incidents: [] as Incident[],
  state: {
    mode: 'LIVE',
    telemetrySource: 'REAL',
    threatLevel: 'LOW',
    activeIncidents: 0,
    highAlerts: 0,
    eps: 0,
    totalEndpoints: 0,
    autonomousDefense: false
  } as SystemState
};

let eventCount = 0;
let eventHistory: NormalizedEvent[] = [];

// Rules are persisted in SQLite and evaluated from memory so analysts can
// create/edit/disable them live without a restart. Indexed by event_type at
// load/persist time so evaluation doesn't scan every rule per event.
let rulesStore: any[] = [];
let rulesByEventType = new Map<string, any[]>();
let rulesGeneral: any[] = [];

function indexRules() {
  rulesByEventType = new Map();
  rulesGeneral = [];
  for (const r of rulesStore) {
    const et = r.condition?.event_type;
    if (et) {
      if (!rulesByEventType.has(et)) rulesByEventType.set(et, []);
      rulesByEventType.get(et)!.push(r);
    } else {
      rulesGeneral.push(r);
    }
  }
}

function recomputeActiveIncidents() {
  store.state.activeIncidents = store.incidents.filter(
    (i: Incident) => (i.status as string) !== 'CLOSED' && (i.status as string) !== 'RESOLVED'
  ).length;
}

// Severity-weighted threat level with exponential decay: recent high-severity
// alerts score heavily, older ones fade out (half-life 10 min) so the KPI
// reflects current conditions instead of a static 'LOW' or stale spikes.
const SEVERITY_WEIGHT: Record<string, number> = { CRITICAL: 100, HIGH: 60, MEDIUM: 30, LOW: 10, INFORMATIONAL: 0 };
const DECAY_HALF_LIFE_MS = 10 * 60 * 1000;

function computeThreatLevel(): string {
  const now = Date.now();
  let score = 0;
  for (const a of store.alerts) {
    const weight = SEVERITY_WEIGHT[a.severity] ?? 0;
    if (weight === 0) continue;
    const ageMs = now - new Date(a.timestamp).getTime();
    if (ageMs < 0 || ageMs > 60 * 60 * 1000) continue; // ignore future/older than 1h
    score += weight * Math.pow(0.5, ageMs / DECAY_HALF_LIFE_MS);
  }
  if (score >= 80) return 'CRITICAL';
  if (score >= 40) return 'HIGH';
  if (score >= 15) return 'ELEVATED';
  if (score >= 5) return 'GUARDED';
  return 'LOW';
}

setInterval(async () => {
  store.state.eps = Math.round(eventCount / 2);
  eventCount = 0;
  store.state.threatLevel = computeThreatLevel() as any;
  try {
     const agents = await getAgents();
     store.state.totalEndpoints = agents.length;
  } catch(e) {}
  eventBus.emit('state_update', store.state);
}, 2000);

function saveIncidentToDb(inc: Incident) {
    try {
        db.prepare(`INSERT INTO incidents (id, title, severity, status, affected_assets, created_at, resolved_at, alerts, events, iocs, mitre_techniques, case_owner, case_notes, case_tasks, case_evidence, ai_analysis, blocked_ips)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET 
                        title=excluded.title, severity=excluded.severity, status=excluded.status, 
                        affected_assets=excluded.affected_assets, resolved_at=excluded.resolved_at,
                        alerts=excluded.alerts, events=excluded.events, iocs=excluded.iocs,
                        mitre_techniques=excluded.mitre_techniques, case_owner=excluded.case_owner,
                        case_notes=excluded.case_notes, case_tasks=excluded.case_tasks,
                        case_evidence=excluded.case_evidence, ai_analysis=excluded.ai_analysis,
                        blocked_ips=excluded.blocked_ips`)
          .run(inc.incident_id, inc.title, inc.severity, inc.status, JSON.stringify(inc.affected_assets || []), 
               inc.created_at, inc.status === 'RESOLVED' ? inc.updated_at : null,
               JSON.stringify(inc.alerts || []), JSON.stringify(inc.events || []), JSON.stringify(inc.iocs || []),
               JSON.stringify(inc.mitre_techniques || []), inc.case_owner || null,
               JSON.stringify(inc.case_notes || []), JSON.stringify(inc.case_tasks || []),
               JSON.stringify(inc.case_evidence || []), JSON.stringify(inc.ai_analysis || null),
               JSON.stringify((inc as any).blocked_ips || []));
    } catch(e: any) { logger.error('db_write_error', { error: e?.message || String(e) }); }
}

async function loadIncidents() {
  try {
    const rows = db.prepare('SELECT * FROM incidents ORDER BY created_at DESC LIMIT 50').all();
    store.incidents = rows.map((r: any) => {
      return {
         incident_id: r.id,
         title: r.title,
         severity: r.severity,
         status: r.status,
         created_at: r.created_at,
         updated_at: r.resolved_at || r.created_at,
         affected_assets: r.affected_assets ? JSON.parse(r.affected_assets) : [],
         affected_users: [],
         alerts: r.alerts ? JSON.parse(r.alerts) : [],
         events: r.events ? JSON.parse(r.events) : [],
         iocs: r.iocs ? JSON.parse(r.iocs) : [],
         mitre_techniques: r.mitre_techniques ? JSON.parse(r.mitre_techniques) : [],
         case_owner: r.case_owner || undefined,
         case_notes: r.case_notes ? JSON.parse(r.case_notes) : undefined,
         case_tasks: r.case_tasks ? JSON.parse(r.case_tasks) : undefined,
         case_evidence: r.case_evidence ? JSON.parse(r.case_evidence) : undefined,
         ai_analysis: r.ai_analysis ? JSON.parse(r.ai_analysis) : undefined,
         blocked_ips: r.blocked_ips ? JSON.parse(r.blocked_ips) : [],
         confidence: 1
      };
    }) as Incident[];
    store.state.activeIncidents = store.incidents.filter((i: Incident) => (i.status as string) !== 'CLOSED' && (i.status as string) !== 'RESOLVED').length;
  } catch (e) {
    logger.error("load_incidents_failed", { error: e instanceof Error ? e.message : String(e) });
  }
}
loadIncidents();

function loadRecentEvents() {
  try {
    const rows = db.prepare('SELECT * FROM events ORDER BY timestamp DESC LIMIT 500').all() as any[];
    store.events = rows.map(r => ({ ...r, raw_event: r.raw_event ? JSON.parse(r.raw_event) : r.raw_event }));
    // Seed threshold-matching history (chronological order) so burst rules
    // (e.g. 5x failed RDP logins) still work correctly right after a restart.
    const historyRows = db.prepare('SELECT * FROM events ORDER BY timestamp DESC LIMIT 1000').all() as any[];
    eventHistory = historyRows
      .map(r => ({ ...r, raw_event: r.raw_event ? JSON.parse(r.raw_event) : r.raw_event }))
      .reverse();
    if (store.events.length > 0) logger.info('events_restored', { count: store.events.length });
  } catch (e: any) {
    logger.error('load_events_failed', { error: e?.message || String(e) });
  }
}
loadRecentEvents();

function decodeRule(r: any) {
  return { ...r, enabled: !!r.enabled, condition: r.condition ? JSON.parse(r.condition) : undefined };
}

function loadRules() {
  try {
    const rows = db.prepare('SELECT * FROM rules ORDER BY rule_id').all() as any[];
    if (rows.length === 0) {
      // First boot: seed from the static detection rules in rules.ts
      const ins = db.prepare(
        `INSERT OR IGNORE INTO rules (rule_id, description, mitre_tactic, mitre_technique, severity, enabled, condition)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      for (const r of detectionRules as any[]) {
        ins.run(r.rule_id, r.description, r.mitre_tactic, r.mitre_technique, r.severity, r.enabled ? 1 : 0, JSON.stringify(r.condition || {}));
      }
      rulesStore = (db.prepare('SELECT * FROM rules ORDER BY rule_id').all() as any[]).map(decodeRule);
    } else {
      rulesStore = rows.map(decodeRule);
    }
    indexRules();
    logger.info('rules_loaded', { count: rulesStore.length });
  } catch (e: any) {
    logger.error('load_rules_failed', { error: e?.message || String(e) });
    rulesStore = detectionRules as any[];
    indexRules();
  }
}
loadRules();

// Wazuh Active Response expects an agent ID, not a hostname. Resolve the
// hostname to its agent ID when Wazuh is reachable; fall back to the hostname
// (lab setups may name agents after hosts) if the lookup fails.
async function resolveAgentId(hostname: string): Promise<string> {
  try {
    const agents = await getAgents();
    const agent = agents.find((a: any) => a.name === hostname);
    if (agent && agent.id) return agent.id;
  } catch (e) { /* Wazuh offline — fall through to hostname */ }
  return hostname;
}

startCollector((event) => {
    try { ingestEvent(event); } catch(e: any) { logger.error('collector_ingest_failed', { error: e?.message || String(e) }); }
});

async function ingestEvent(rawEvent: any) {
  eventCount++;
  if (!rawEvent || !rawEvent.timestamp) throw new Error("Invalid event payload");

  const normalized: NormalizedEvent = {
    event_id: uuidv4(),
    timestamp: new Date().toISOString(),
    source: rawEvent.source || 'Wazuh',
    source_type: 'Endpoint',
    hostname: rawEvent.agent?.name || rawEvent.hostname || 'Unknown',
    host_id: rawEvent.agent?.id || rawEvent.agent_id,
    event_type: rawEvent.rule?.groups?.[0] || rawEvent.event_type || 'Unknown',
    event_category: rawEvent.rule?.groups?.[1] || rawEvent.event_category || 'Security',
    severity: (rawEvent.rule?.level >= 7 ? 'HIGH' : rawEvent.rule?.level >= 4 ? 'MEDIUM' : 'LOW') as Severity,
    rule_name: rawEvent.rule?.description || rawEvent.rule_name,
    rule_id: rawEvent.rule?.id,
    raw_event: rawEvent,
    username: rawEvent.data?.win?.eventdata?.user || rawEvent.username,
    process_name: rawEvent.data?.win?.eventdata?.image || rawEvent.process_name,
    parent_process: rawEvent.data?.win?.eventdata?.parentImage || rawEvent.parent_process,
    command_line: rawEvent.data?.win?.eventdata?.commandLine || rawEvent.command_line,
    src_ip: rawEvent.data?.srcip || rawEvent.src_ip,
    dst_ip: rawEvent.data?.dstip || rawEvent.dst_ip,
    file_hash: rawEvent.data?.win?.eventdata?.hashes || rawEvent.file_hash,
  };

  indexEvent(normalized).catch(() => {});

  // Persist every normalized event to SQLite so the UI/hunting still works
  // after a restart and when OpenSearch is unavailable.
  try {
    db.prepare(`INSERT OR REPLACE INTO events (event_id, timestamp, source, source_type, hostname, event_type, event_category, severity, rule_id, rule_name, username, process_name, command_line, src_ip, dst_ip, file_hash, mitre_tactic, mitre_technique, raw_event)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(normalized.event_id, normalized.timestamp, normalized.source, normalized.source_type,
           normalized.hostname || null, normalized.event_type, normalized.event_category, normalized.severity,
           normalized.rule_id || null, normalized.rule_name || null, normalized.username || null,
           normalized.process_name || null, normalized.command_line || null, normalized.src_ip || null,
           normalized.dst_ip || null, normalized.file_hash || null,
           normalized.mitre_tactic || null, normalized.mitre_technique || null,
           JSON.stringify(rawEvent));
  } catch (e: any) {
    logger.error('event_persist_failed', { event_id: normalized.event_id, error: e?.message || String(e) });
  }

  store.events.unshift(normalized);
  if (store.events.length > 1000) store.events.pop();
  eventHistory.push(normalized);
  if (eventHistory.length > 1000) eventHistory.shift();

  eventBus.emit('new_event', normalized);
  logger.debug('event_ingested', {
    event_id: normalized.event_id,
    source: normalized.source,
    hostname: normalized.hostname || 'Unknown',
    event_type: normalized.event_type,
    severity: normalized.severity,
  });
  evaluateRules(normalized);
}

async function evaluateRules(event: NormalizedEvent) {
  // Fast path: only evaluate rules relevant to this event type (indexed at
  // load/persist time) plus the type-agnostic rules.
  const candidates = [
    ...(rulesByEventType.get(event.event_type) || []),
    ...rulesGeneral,
  ];
  for (const rule of candidates) {
    if (!rule.enabled) continue;
    
    let matched = false;
    const cond = rule.condition;

    if (cond) {
        let isMatch = true;
        if (cond.event_type && event.event_type !== cond.event_type) isMatch = false;
        if (cond.command_includes && cond.command_includes.length > 0) {
            const cmd = event.command_line?.toLowerCase() || '';
            if (!cond.command_includes.some((c: string) => cmd.includes(c.toLowerCase()))) {
                isMatch = false;
            }
        }
        if (cond.process_name_includes && cond.process_name_includes.length > 0) {
            const proc = event.process_name?.toLowerCase() || '';
            if (!cond.process_name_includes.some((p: string) => proc.includes(p.toLowerCase()))) {
                isMatch = false;
            }
        }

        if (isMatch) {
            if (cond.threshold && cond.threshold > 1) {
                const nowTime = new Date(event.timestamp).getTime();
                const windowMs = cond.window_seconds * 1000;
                const matches = eventHistory.filter(e => {
                    if (e.hostname !== event.hostname) return false;
                    if (cond.event_type && e.event_type !== cond.event_type) return false;
                    return (nowTime - new Date(e.timestamp).getTime()) <= windowMs;
                });
                if (matches.length >= cond.threshold) matched = true;
            } else {
                matched = true;
            }
        }
    }

    if (matched) {
      event.mitre_tactic = rule.mitre_tactic;
      event.mitre_technique = rule.mitre_technique;

      logger.info('rule_matched', {
        event_id: event.event_id,
        rule_id: rule.rule_id,
        rule_name: rule.description,
        severity: rule.severity,
        hostname: event.hostname || 'Unknown',
      });

      // --- Alert aggregation: suppress duplicate alerts for the same rule + host
      // within the dedup window. The existing alert's count is bumped and the new
      // event is still attached to the correlated incident (full timeline kept),
      // but the alerts list doesn't get flooded with N identical alerts.
      const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
      const duplicate = store.alerts.find(a =>
        a.rule_name === rule.description &&
        a.events.some(e => e.hostname === event.hostname) &&
        (Date.now() - new Date(a.timestamp).getTime()) < DEDUP_WINDOW_MS
      );

      if (duplicate) {
        duplicate.count = (duplicate.count || 1) + 1;
        duplicate.events.push(event);
        if (duplicate.events.length > 50) duplicate.events.shift();
        logger.info('alert_aggregated', {
          alert_id: duplicate.alert_id,
          rule_name: duplicate.rule_name,
          hostname: event.hostname || 'Unknown',
          count: duplicate.count,
        });
        eventBus.emit('alert_updated', duplicate);
        await correlateAlert(duplicate);
        continue; // check remaining rules for this event; do NOT create a new alert
      }

      const alert: Alert = {
        alert_id: uuidv4(),
        timestamp: new Date().toISOString(),
        rule_name: rule.description,
        severity: (rule.severity?.toUpperCase() || 'MEDIUM') as Severity,
        confidence: 0.9,
        events: [event],
        mitre_tactic: rule.mitre_tactic,
        mitre_technique: rule.mitre_technique
      };
      
      store.alerts.unshift(alert);
      if (store.alerts.length > 1000) store.alerts.pop();

      if (alert.severity === 'HIGH' || alert.severity === 'CRITICAL') {
        store.state.highAlerts++;
      }

      logger.info('alert_created', {
        alert_id: alert.alert_id,
        rule_name: alert.rule_name,
        severity: alert.severity,
        hostname: event.hostname || 'Unknown',
      });
      eventBus.emit('new_alert', alert);
      if (alert.severity === 'HIGH' || alert.severity === 'CRITICAL') {
        sendWebhook('alert', {
          alert_id: alert.alert_id,
          rule_name: alert.rule_name,
          severity: alert.severity,
          hostname: event.hostname || 'Unknown',
          mitre_tactic: rule.mitre_tactic,
          mitre_technique: rule.mitre_technique,
        });
      }
      const incident = await correlateAlert(alert);
      
      if (store.state.autonomousDefense && (rule.severity === 'HIGH' || rule.severity === 'CRITICAL')) {
         if (event.hostname) {
             // Wazuh Active Response needs the agent ID — resolve hostname first
             // (same as the manual Response-tab isolation path).
             const targetAgentId = await resolveAgentId(event.hostname);
             const result = await isolateHost(targetAgentId);
             logger.info('soar_auto_isolate', { target: event.hostname, agent_id: targetAgentId, result: result.status });
             try {
                db.prepare(`INSERT INTO audit_logs (id, timestamp, action, user_email, details) VALUES (?, ?, ?, ?, ?)`)
                  .run(uuidv4(), new Date().toISOString(), "AUTONOMOUS_DEFENSE_ISOLATE", "System-SOAR", JSON.stringify({ target: event.hostname, result }));
             } catch(e: any) { logger.error('audit_write_failed', { error: e?.message || String(e) }); }

             if (incident && result.status === 'SUCCESS') {
                 incident.status = 'CONTAINMENT';
                 if (!incident.case_notes) incident.case_notes = [];
                 incident.case_notes.push({
                     timestamp: new Date().toISOString(),
                     author: 'SOAR-Bot',
                     content: `Executed Auto-Containment playbook. Isolated host ${event.hostname} via Wazuh. Status: SUCCESS.`
                 });
                 saveIncidentToDb(incident);
                 eventBus.emit('incident_updated', incident);
             }
         }
      }
    }
  }
}

async function correlateAlert(alert: Alert): Promise<Incident | null> {
  const event = alert.events[0];
  const targetHost = event.hostname;
  if (!targetHost) return null;

  // Correlation v2: attach to an open incident on the same host OR the same
  // user account within 24h (host match preferred, user match as fallback) —
  // catches lateral movement where the same compromised user pops up on
  // multiple endpoints.
  const now = Date.now();
  const openAndFresh = (i: Incident) =>
    (i.status as string) !== 'RESOLVED' && (i.status as string) !== 'CLOSED' &&
    now - new Date(i.created_at).getTime() < 24 * 3600 * 1000;

  let incident = store.incidents.find(
    (i: Incident) => openAndFresh(i) && i.affected_assets.includes(targetHost)
  );
  if (!incident && event.username) {
    incident = store.incidents.find(
      (i: Incident) => openAndFresh(i) && i.affected_users.includes(event.username)
    );
  }

  if (incident) {
    // Severity upgrade: if this alert is more severe than the incident so far,
    // bump the incident (e.g. MEDIUM incident + CRITICAL alert -> CRITICAL).
    const rank: Record<string, number> = { INFORMATIONAL: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
    if ((rank[alert.severity] ?? 0) > (rank[incident.severity] ?? 0)) {
      incident.severity = alert.severity;
      logger.info('incident_severity_upgraded', {
        incident_id: incident.incident_id,
        from: incident.severity, to: alert.severity, alert_id: alert.alert_id,
      });
    }
    incident.confidence = Math.max(incident.confidence, alert.confidence);
    // Idempotent merge: with alert aggregation the same alert object can be
    // correlated multiple times — never attach an alert/event twice.
    if (!incident.alerts.some(a => a.alert_id === alert.alert_id)) {
        incident.alerts.push(alert);
    }
    // Attach every event carried by the alert (new alerts carry 1; aggregated
    // alerts carry the full burst) that is not already in the incident.
    for (const ev of alert.events) {
        if (incident.events.some(e => e.event_id === ev.event_id)) continue;
        incident.events.push(ev);
        if (ev.username && !incident.affected_users.includes(ev.username)) {
            incident.affected_users.push(ev.username);
        }
    }
    if (incident.events.length > 500) {
        incident.events.splice(0, incident.events.length - 500); // keep timeline bounded
    }
    if (!incident.mitre_techniques.includes(alert.mitre_technique!)) {
        incident.mitre_techniques.push(alert.mitre_technique!);
    }
    incident.updated_at = new Date().toISOString();

    logger.info('incident_attached', {
      incident_id: incident.incident_id,
      alert_id: alert.alert_id,
      hostname: targetHost,
      alert_count: incident.alerts.length,
      event_count: incident.events.length,
    });

    saveIncidentToDb(incident);
    eventBus.emit('incident_updated', incident);
  } else {
    const incId = `INC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    incident = {
      incident_id: incId,
      title: `Suspicious Activity on ${targetHost}`,
      severity: alert.severity,
      confidence: alert.confidence,
      status: 'NEW',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      affected_assets: [targetHost],
      affected_users: event.username ? [event.username] : [],
      alerts: [alert],
      events: [event],
      iocs: [],
      mitre_techniques: alert.mitre_technique ? [alert.mitre_technique] : []
    };
    
    store.incidents.unshift(incident);
    if (store.incidents.length > 500) store.incidents.pop(); // keep memory bounded
    recomputeActiveIncidents(); // always derive from the actual list (no drift)

    saveIncidentToDb(incident);
    eventBus.emit('new_incident', incident);

    sendWebhook('incident', {
      incident_id: incident.incident_id,
      title: incident.title,
      severity: incident.severity,
      status: incident.status,
      hostname: targetHost,
      mitre_techniques: incident.mitre_techniques,
    });

    logger.info('incident_created', {
      incident_id: incident.incident_id,
      title: incident.title,
      severity: incident.severity,
      hostname: targetHost,
    });

    // Real AI triage (Paul) — async, non-blocking; enriches the incident when it returns
    logger.debug('ai_triage_started', { incident_id: incident.incident_id });
    runAIAnalysis(incident).then(analysis => {
      incident.ai_analysis = analysis;
      if (analysis.severity) incident.severity = analysis.severity as Severity;
      incident.updated_at = new Date().toISOString();
      saveIncidentToDb(incident);
      eventBus.emit('incident_updated', incident);
      logger.info('ai_triage_completed', {
        incident_id: incident.incident_id,
        classification: analysis.classification,
        severity: analysis.severity,
        confidence: analysis.confidence,
      });
    }).catch(err => logger.error('ai_triage_failed', { incident_id: incident.incident_id, error: err instanceof Error ? err.message : String(err) }));
  }

  if (event.file_hash) {
      const result = await lookupHash(event.file_hash);
      if (result.malicious) {
          incident.iocs.push({ type: 'hash', value: event.file_hash, malicious: true, source: result.source });
          saveIncidentToDb(incident);
          eventBus.emit('incident_updated', incident);
          logger.info('ioc_malicious', { incident_id: incident.incident_id, hash: event.file_hash, source: result.source });
      }
  }
  return incident;
}

const isAnalystRole = (role?: string) => role === 'ADMIN' || role === 'ANALYST' || role === 'ROOT';
const isAdminRole = (role?: string) => role === 'ADMIN' || role === 'ROOT';

// AUTO_AUTH (demo/preview mode): when enabled, requests without a valid token
// are treated as the seeded admin user — the dashboard opens without a login
// page. NEVER enable in production (anyone who can reach the server is admin).
const AUTO_AUTH = process.env.AUTO_AUTH === 'true';

function autoAuthUser(): any | null {
  if (!AUTO_AUTH) return null;
  const email = process.env.ADMIN_EMAIL;
  if (!email) return null;
  try {
    return db.prepare('SELECT id, email, role FROM users WHERE email = ?').get(email) || null;
  } catch {
    return null;
  }
}

const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Token from the Authorization header (API clients) or the httpOnly
  // session cookie (browser, XSS-resistant — the JWT never touches JS/localStorage).
  const authHeader = req.headers.authorization;
  let token: string | undefined;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if ((req as any).cookies?.soc_token) {
    token = (req as any).cookies.soc_token;
  }
  if (!token) {
    // AUTO_AUTH (demo/preview): no login needed.
    const auto = autoAuthUser();
    if (auto) {
      (req as any).user = { uid: auto.id, email: auto.email, role: auto.role };
      return next();
    }
    logger.warn('auth_401_no_token', { path: req.path });
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: "Server misconfiguration" });
    const decoded = jwt.verify(token, secret) as any;
    // Re-check the user against the DB on every request: deleted users lose
    // access immediately and role changes take effect without re-login.
    const user = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(decoded.uid) as any;
    if (!user) {
      const auto = autoAuthUser();
      if (auto) {
        (req as any).user = { uid: auto.id, email: auto.email, role: auto.role };
        return next();
      }
      logger.warn('auth_401_user_missing', { path: req.path, uid: decoded.uid });
      return res.status(401).json({ error: "Invalid token" });
    }
    (req as any).user = { uid: user.id, email: user.email, role: user.role };
    next();
  } catch (err) {
    const auto = autoAuthUser();
    if (auto) {
      (req as any).user = { uid: auto.id, email: auto.email, role: auto.role };
      return next();
    }
    logger.warn('auth_401_bad_token', { path: req.path, error: err instanceof Error ? err.message : String(err) });
    return res.status(401).json({ error: "Invalid token" });
  }
};

const requireAnalyst = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (!isAnalystRole(user.role)) {
        return res.status(403).json({ error: "Insufficient clearance" });
    }
    next();
};

const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!isAdminRole((req as any).user?.role)) {
        return res.status(403).json({ error: "Insufficient clearance" });
    }
    next();
};

// Endpoint agents / log forwarders authenticate with a shared ingest key OR a valid JWT.
const requireIngestAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ingestKey = process.env.INGEST_API_KEY;
    const provided = req.headers['x-ingest-key'];
    if (ingestKey && provided && provided === ingestKey) return next();
    return requireAuth(req, res, next);
};

app.get("/api/state", requireAuth, (req, res) => {
  res.json(store.state);
});

// The platform is real-time only — no simulation modes. This endpoint is kept
// as a read-only confirmation that the system runs exclusively on live telemetry.
app.get("/api/state/mode", requireAuth, (req, res) => {
  res.json({ mode: 'LIVE', telemetrySource: 'REAL', simulated: false });
});

app.post("/api/state/defense", requireAuth, requireAnalyst, (req, res) => {
  const { active } = req.body;
  store.state.autonomousDefense = active;
  try {
      db.prepare(`INSERT INTO audit_logs (id, timestamp, action, user_email, details) VALUES (?, ?, ?, ?, ?)`)
        .run(uuidv4(), new Date().toISOString(), "UPDATE_SOAR_CONFIG", (req as any).user.email, JSON.stringify({ active }));
  } catch(e: any) { logger.error('audit_write_failed', { error: e?.message || String(e) }); }
  eventBus.emit('state_update', store.state);
  res.json({ success: true, autonomousDefense: store.state.autonomousDefense });
});

app.post("/api/incidents/:id/action", requireAuth, requireAnalyst, async (req, res) => {
  const { action, payload } = req.body;
  const incident = store.incidents.find(i => i.incident_id === req.params.id);
  if (!incident) return res.status(404).json({ error: "Incident not found" });

  if (action === 'UPDATE_STATUS') {
    incident.status = payload.status;
    recomputeActiveIncidents(); // derive from the actual list (no drift)
  } else if (action === 'CASE_UPDATE') {
    if (payload.case_owner) incident.case_owner = payload.case_owner;
    if (payload.case_notes) incident.case_notes = payload.case_notes;
    if (payload.case_tasks) incident.case_tasks = payload.case_tasks;
    if (payload.case_evidence) incident.case_evidence = payload.case_evidence;
  } else if (action === 'ISOLATE_HOST') {
    const targetAgentId = await resolveAgentId(payload.hostname);
    const result = await isolateHost(targetAgentId);
    if (result.status === 'SUCCESS') {
        try {
            db.prepare(`INSERT INTO audit_logs (id, timestamp, action, user_email, details) VALUES (?, ?, ?, ?, ?)`)
              .run(uuidv4(), new Date().toISOString(), "ISOLATE_HOST_SUCCESS", (req as any).user.email, JSON.stringify(result));
        } catch(e: any) { logger.error('audit_write_failed', { error: e?.message || String(e) }); }
        res.json({ success: true, result });
        return;
    } else {
        return res.status(500).json(result);
    }
  } else if (action === 'BLOCK_IP') {
    const ip = payload?.ip as string | undefined;
    if (!ip || typeof ip !== 'string') return res.status(400).json({ error: "ip is required" });
    if (!incident.blocked_ips) incident.blocked_ips = [];
    if (!incident.blocked_ips.includes(ip)) {
        incident.blocked_ips.push(ip);
        audit(req, 'BLOCK_IP', { incident: incident.incident_id, ip });
        logger.info('ip_blocked', { by: (req as any).user?.email, incident: incident.incident_id, ip });
        res.json({ success: true, blocked_ips: incident.blocked_ips });
        saveIncidentToDb(incident);
        eventBus.emit('incident_updated', incident);
        return;
    }
    res.json({ success: true, blocked_ips: incident.blocked_ips });
    return;
  }
  
  saveIncidentToDb(incident);

  try {
        db.prepare(`INSERT INTO audit_logs (id, timestamp, action, user_email, details) VALUES (?, ?, ?, ?, ?)`)
          .run(uuidv4(), new Date().toISOString(), `INCIDENT_${action}`, (req as any).user.email, JSON.stringify({ incident: incident.incident_id }));
  } catch(e: any) { logger.error('audit_write_failed', { error: e?.message || String(e) }); }

  eventBus.emit('incident_updated', incident);
  eventBus.emit('state_update', store.state);
  res.json({ success: true, incident });
});



app.get("/api/wazuh/agents", requireAuth, async (req, res) => {
  try {
      const result = await getAgents();
      res.json(result);
  } catch(e: any) {
      res.status(503).json({ error: e.message || 'Wazuh Offline' });
  }
});

app.post("/api/events/ingest", requireIngestAuth, (req, res) => {
  try {
    const body = req.body;
    const batch = Array.isArray(body) ? body : (Array.isArray(body?.events) ? body.events : [body]);
    let accepted = 0;
    for (const ev of batch) {
      if (!ev || typeof ev !== 'object') continue;
      ingestEvent(ev);
      accepted++;
    }
    res.json({ status: "ingested", accepted });
  } catch(e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/state/telemetry", requireAuth, async (req, res) => {
    let wazuhStatus = "OFFLINE";
    let openSearchStatus = "OFFLINE";

    try {
       await getAgents();
       wazuhStatus = "CONNECTED";
    } catch(e: any) {
       logger.debug('telemetry_wazuh_check_failed', { error: e?.message || String(e) });
    }

    try {
        const client = getClient(); // static import — no ESM require() breakage
        await client.info();
        openSearchStatus = "CONNECTED";
    } catch(e: any) {
        logger.debug('telemetry_opensearch_check_failed', { error: e?.message || String(e) });
    }

    res.json({
        wazuh: wazuhStatus,
        opensearch: openSearchStatus,
        threatLevel: store.state.threatLevel,
        gemini: (process.env.GEMINI_API_KEY || process.env.PAUL_AI_API_KEY) ? "CONFIGURED" : "MISSING",
        threatIntel: (process.env.VIRUSTOTAL_API_KEY || process.env.OTX_API_KEY) ? "CONFIGURED" : "MISSING"
    });
});

app.post("/api/chat", requireAuth, requireAnalyst, chatLimiter, async (req, res) => {
  const { incident_id, message, history } = req.body;
  
  // Real DB fetch for incident analysis
  let dbIncident: any;
  try {
      const row = db.prepare('SELECT * FROM incidents WHERE id = ?').get(incident_id) as any;
      if (row) {
         dbIncident = { ...row, affected_assets: row.affected_assets ? JSON.parse(row.affected_assets as string) : [] };
      }
  } catch(e){}
  
  const incident = store.incidents.find(i => i.incident_id === incident_id) || dbIncident;
  if (!incident) return res.status(404).json({ error: "Incident not found for analysis" });
  
  try {
    const reply = await interrogateAI(incident, message, history || []);
    res.json({ reply });
  } catch(e) {
    res.status(503).json({ error: "AI Analysis Unavailable" });
  }
});

app.post("/api/chat/global", requireAuth, requireAnalyst, chatLimiter, async (req, res) => {
  const { message, history } = req.body;
  try {
    const reply = await interrogateGlobalAI(store, message, history || []);
    res.json({ reply });
  } catch (e) {
    res.status(503).json({ error: "AI Analysis Unavailable" });
  }
});

// Authentication — real email + password login (bcrypt) issuing a JWT with role for RBAC
app.post("/api/login", authLimiter, async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
        logger.warn('login_failed', { email: String(email || '').slice(0, 80), reason: 'missing_fields' });
        return res.status(400).json({ error: "Email and password are required" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: 'JWT_SECRET missing in server configuration' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    // Constant-ish response to avoid user enumeration
    if (!user || !user.password_hash) {
        logger.warn('login_failed', { email: String(email).slice(0, 80), reason: 'no_user' });
        return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
        logger.warn('login_failed', { email: String(email).slice(0, 80), reason: 'bad_password' });
        return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ uid: user.id, email: user.email, role: user.role }, secret, { expiresIn: '8h' });
    // Session cookie. When the request arrived over the https preview proxy,
    // use SameSite=None + Secure + Partitioned (CHIPS) so the cookie also
    // works inside cross-site embedded iframes (Chrome blocks plain
    // third-party cookies). On plain localhost keep SameSite=Lax.
    const viaProxy = req.headers['x-forwarded-proto'] === 'https';
    const cookieOpts: any = {
      httpOnly: true,
      sameSite: viaProxy ? 'none' : 'lax',
      secure: viaProxy || process.env.NODE_ENV === 'production',
      maxAge: 8 * 3600 * 1000,
      path: '/',
    };
    if (viaProxy) cookieOpts.partitioned = true;
    res.cookie('soc_token', token, cookieOpts);
    logger.info('login_success', { email: user.email, role: user.role });
    try {
        db.prepare(`INSERT INTO audit_logs (id, timestamp, action, user_email, details) VALUES (?, ?, ?, ?, ?)`)
          .run(uuidv4(), new Date().toISOString(), "LOGIN", user.email, JSON.stringify({ ip: req.ip }));
    } catch(e: any) { logger.error('audit_write_failed', { error: e?.message || String(e) }); }
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});

app.post("/api/logout", (req, res) => {
    const email = (req as any).user?.email || (req as any).cookies?.soc_token ? 'session' : 'unknown';
    try {
        db.prepare(`INSERT INTO audit_logs (id, timestamp, action, user_email, details) VALUES (?, ?, ?, ?, ?)`)
          .run(uuidv4(), new Date().toISOString(), "LOGOUT", typeof email === 'string' ? email : 'unknown', JSON.stringify({}));
    } catch (e: any) { logger.error('audit_write_failed', { error: e?.message || String(e) }); }
    res.clearCookie('soc_token', { path: '/' });
    res.json({ success: true });
});

app.get("/api/me", requireAuth, (req, res) => {
    const user = (req as any).user;
    res.json({ role: user.role, email: user.email });
});

app.get("/api/audit", requireAuth, requireAnalyst, (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 50').all();
        res.json(rows);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Client-driven audit events (e.g. "BLOCK_IP", UI-only actions). Authenticated,
// validated, and stamped server-side — the caller's identity comes from the JWT,
// never from the body.
app.post("/api/audit", requireAuth, requireAnalyst, auditLimiter, (req, res) => {
    const { action, details } = req.body || {};
    if (!action || typeof action !== 'string' || action.length > 64) {
        return res.status(400).json({ error: "action (string) is required" });
    }
    if (details !== undefined && (typeof details !== 'object' || Array.isArray(details))) {
        return res.status(400).json({ error: "details must be an object" });
    }
    audit(req, action, details || {});
    res.status(201).json({ success: true });
});

// --- User management (admin only) — the way to provision ANALYST accounts ---
app.get("/api/users", requireAuth, requireAdmin, (req, res) => {
    try {
        const rows = db.prepare('SELECT id, email, role, created_at FROM users ORDER BY created_at ASC').all();
        res.json(rows);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/users", requireAuth, requireAdmin, adminLimiter, (req, res) => {
    const { email, password, role } = req.body || {};
    if (!email || !password || !role) return res.status(400).json({ error: "email, password and role are required" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Invalid email address" });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
    if (role !== 'ADMIN' && role !== 'ANALYST') return res.status(400).json({ error: "role must be ADMIN or ANALYST" });

    try {
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existing) return res.status(409).json({ error: "User already exists" });
        const id = uuidv4();
        db.prepare('INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)')
          .run(id, email, bcrypt.hashSync(password, 10), role);
        db.prepare(`INSERT INTO audit_logs (id, timestamp, action, user_email, details) VALUES (?, ?, ?, ?, ?)`)
          .run(uuidv4(), new Date().toISOString(), "CREATE_USER", (req as any).user.email, JSON.stringify({ email, role }));
        logger.info('user_created', { by: (req as any).user.email, email, role });
        res.status(201).json({ success: true, user: { id, email, role } });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.delete("/api/users/:id", requireAuth, requireAdmin, adminLimiter, (req, res) => {
    try {
        const target = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(req.params.id) as any;
        if (!target) return res.status(404).json({ error: "User not found" });
        if (target.id === (req as any).user.uid) return res.status(400).json({ error: "You cannot delete your own account" });
        db.prepare('DELETE FROM users WHERE id = ?').run(target.id);
        db.prepare(`INSERT INTO audit_logs (id, timestamp, action, user_email, details) VALUES (?, ?, ?, ?, ?)`)
          .run(uuidv4(), new Date().toISOString(), "DELETE_USER", (req as any).user.email, JSON.stringify({ email: target.email, role: target.role }));
        logger.info('user_deleted', { by: (req as any).user.email, email: target.email });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Pagination helper: ?limit= (default 100, max 500) & ?offset= (default 0)
function pageParams(req: express.Request, defLimit = 100, maxLimit = 500) {
  const rawLimit = parseInt(String(req.query.limit), 10);
  const rawOffset = parseInt(String(req.query.offset), 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defLimit;
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0;
  return { limit, offset };
}

app.get("/api/events", requireAuth, (req, res) => {
  const { limit, offset } = pageParams(req);
  res.setHeader('X-Total-Count', String(store.events.length));
  res.json(store.events.slice(offset, offset + limit));
});

app.get("/api/events/search", requireAuth, async (req, res) => {
  const q = (req.query.q as string || '').trim();
  try {
      const results = await searchEvents(q);
      res.json(results);
  } catch (e: any) {
      // OpenSearch unavailable — fall back to the local SQLite event store so
      // threat hunting keeps working without the indexer.
      const like = `%${q}%`;
      try {
          const rows = db.prepare(
            `SELECT * FROM events WHERE hostname LIKE ? OR event_type LIKE ? OR rule_name LIKE ?
             OR command_line LIKE ? OR src_ip LIKE ? OR username LIKE ?
             ORDER BY timestamp DESC LIMIT 50`
          ).all(like, like, like, like, like, like) as any[];
          res.json(rows.map(r => ({ ...r, raw_event: r.raw_event ? JSON.parse(r.raw_event) : null })));
      } catch (dbErr: any) {
          res.status(503).json({ error: dbErr.message });
      }
  }
});

// --- Detection rule management (live, persisted) ---
const VALID_SEVERITIES = ['INFORMATIONAL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

// Central audit-trail writer: stamps the acting user from the JWT and the
// timestamp server-side, so clients can never forge who did what.
function audit(req: express.Request, action: string, details: any) {
  try {
    db.prepare(`INSERT INTO audit_logs (id, timestamp, action, user_email, details) VALUES (?, ?, ?, ?, ?)`)
      .run(uuidv4(), new Date().toISOString(), action, (req as any).user?.email || 'system', JSON.stringify(details || {}));
  } catch (e: any) {
    logger.error('audit_write_failed', { error: e?.message || String(e) });
  }
}

function validateRuleBody(body: any): string | null {
  if (!body || typeof body !== 'object') return "Rule body required";
  if (body.description !== undefined && (typeof body.description !== 'string' || !body.description.trim())) return "description must be a non-empty string";
  if (body.severity !== undefined && !VALID_SEVERITIES.includes((body.severity || '').toUpperCase())) return "severity must be one of " + VALID_SEVERITIES.join(', ');
  if (body.enabled !== undefined && typeof body.enabled !== 'boolean') return "enabled must be a boolean";
  if (body.condition !== undefined && (typeof body.condition !== 'object' || Array.isArray(body.condition))) return "condition must be a JSON object";
  return null;
}

function persistRule(rule: any) {
  db.prepare(`INSERT OR REPLACE INTO rules (rule_id, description, mitre_tactic, mitre_technique, severity, enabled, condition)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(rule.rule_id, rule.description, rule.mitre_tactic || '', rule.mitre_technique || '', rule.severity,
         rule.enabled ? 1 : 0, JSON.stringify(rule.condition || {}));
  rulesStore = (db.prepare('SELECT * FROM rules ORDER BY rule_id').all() as any[]).map(decodeRule);
  indexRules();
}

// All externally-blocked IPs across incidents (used by the Response tab /
// future firewall integration).
app.get("/api/blocked-ips", requireAuth, requireAnalyst, (req, res) => {
    const ips = new Set<string>();
    for (const i of store.incidents) {
        for (const ip of (i as any).blocked_ips || []) ips.add(ip);
    }
    res.json([...ips]);
});

app.get("/api/rules", requireAuth, (req, res) => res.json(rulesStore));

app.post("/api/rules", requireAuth, requireAnalyst, (req, res) => {
  const err = validateRuleBody(req.body);
  if (err) return res.status(400).json({ error: err });

  const { description, mitre_tactic, mitre_technique, severity, enabled, condition } = req.body;
  if (!description || !severity) return res.status(400).json({ error: "description and severity are required" });

  const rule = {
    rule_id: `R${Math.floor(100000 + Math.random() * 900000)}`,
    description,
    mitre_tactic: mitre_tactic || 'Uncategorized',
    mitre_technique: mitre_technique || '',
    severity: severity.toUpperCase(),
    enabled: enabled !== false,
    condition: condition || {}
  };
  persistRule(rule);
  audit(req, "CREATE_RULE", { rule_id: rule.rule_id, description: rule.description, severity: rule.severity });
  logger.info('rule_created', { by: (req as any).user.email, rule_id: rule.rule_id, description: rule.description });
  res.status(201).json(rule);
});

app.put("/api/rules/:id", requireAuth, requireAnalyst, (req, res) => {
  const err = validateRuleBody(req.body);
  if (err) return res.status(400).json({ error: err });

  const existing = rulesStore.find((r: any) => r.rule_id === req.params.id);
  if (!existing) return res.status(404).json({ error: "Rule not found" });

  const updated = {
    ...existing,
    description: req.body.description !== undefined ? req.body.description : existing.description,
    mitre_tactic: req.body.mitre_tactic !== undefined ? req.body.mitre_tactic : existing.mitre_tactic,
    mitre_technique: req.body.mitre_technique !== undefined ? req.body.mitre_technique : existing.mitre_technique,
    severity: req.body.severity !== undefined ? req.body.severity.toUpperCase() : existing.severity,
    enabled: req.body.enabled !== undefined ? req.body.enabled : existing.enabled,
    condition: req.body.condition !== undefined ? req.body.condition : existing.condition
  };
  persistRule(updated);
  audit(req, "UPDATE_RULE", { rule_id: updated.rule_id, changes: req.body });
  logger.info('rule_updated', { by: (req as any).user.email, rule_id: updated.rule_id, enabled: updated.enabled });
  res.json(updated);
});

app.delete("/api/rules/:id", requireAuth, requireAnalyst, (req, res) => {
  const existing = rulesStore.find((r: any) => r.rule_id === req.params.id);
  if (!existing) return res.status(404).json({ error: "Rule not found" });

  db.prepare('DELETE FROM rules WHERE rule_id = ?').run(existing.rule_id);
  rulesStore = (db.prepare('SELECT * FROM rules ORDER BY rule_id').all() as any[]).map(decodeRule);
  audit(req, "DELETE_RULE", { rule_id: existing.rule_id, description: existing.description });
  logger.info('rule_deleted', { by: (req as any).user.email, rule_id: existing.rule_id });
  res.json({ success: true });
});

app.get("/api/alerts", requireAuth, (req, res) => {
  const { limit, offset } = pageParams(req);
  res.setHeader('X-Total-Count', String(store.alerts.length));
  res.json(store.alerts.slice(offset, offset + limit));
});
app.get("/api/incidents", requireAuth, (req, res) => {
  const { limit, offset } = pageParams(req);
  res.setHeader('X-Total-Count', String(store.incidents.length));
  res.json(store.incidents.slice(offset, offset + limit));
});

app.get("/api/incidents/:id", requireAuth, (req, res) => {
  const incident = store.incidents.find(i => i.incident_id === req.params.id);
  if (incident) res.json(incident);
  else res.status(404).json({ error: "Not found" });
});

// Short-lived token for the SSE stream — the long-lived API JWT never touches
// the query string (which would leak it into proxy/access logs).
app.post("/api/stream/token", requireAuth, (req, res) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: "Server misconfiguration" });
    const token = jwt.sign(
        { uid: (req as any).user.uid, email: (req as any).user.email, scope: 'stream' },
        secret,
        { expiresIn: '2m' }
    );
    res.json({ token, expiresIn: 120 });
});

// SSE Endpoint (stream-scoped token only)
app.get("/api/stream", (req, res) => {
  const token = req.query.token as string;
  if (!token) return res.status(401).end();
  try {
      const secret = process.env.JWT_SECRET;
      if (!secret) return res.status(500).end();
      const decoded = jwt.verify(token, secret) as any;
      if (decoded.scope !== 'stream') return res.status(401).end();
  } catch (e) {
      return res.status(401).end();
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });
  
  const sendEvent = (type: string, data: any) => {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const onNewEvent = (e: NormalizedEvent) => sendEvent('new_event', e);
  const onNewAlert = (a: Alert) => sendEvent('new_alert', a);
  const onNewIncident = (i: Incident) => sendEvent('new_incident', i);
  const onIncidentUpdate = (i: Incident) => sendEvent('incident_updated', i);
  const onStateUpdate = (s: SystemState) => sendEvent('state_update', s);

  eventBus.on('new_event', onNewEvent);
  eventBus.on('new_alert', onNewAlert);
  eventBus.on('new_incident', onNewIncident);
  eventBus.on('incident_updated', onIncidentUpdate);
  eventBus.on('state_update', onStateUpdate);

  sendEvent('state_update', store.state);

  req.on("close", () => {
    eventBus.off('new_event', onNewEvent);
    eventBus.off('new_alert', onNewAlert);
    eventBus.off('new_incident', onNewIncident);
    eventBus.off('incident_updated', onIncidentUpdate);
    eventBus.off('state_update', onStateUpdate);
  });
});


// SOAR playbook inventory — reflects what the engine actually does, with
// live enable state (auto-containment follows the autonomous-defense toggle).
app.get("/api/workflows", requireAuth, requireAnalyst, (req, res) => {
    res.json([
      {
        id: 'auto-containment',
        name: 'Auto-Containment',
        description: 'On HIGH/CRITICAL detection, isolate the affected host via Wazuh Active Response and record an SOAR-Bot case note.',
        triggers: ['HIGH / CRITICAL rule match', 'Autonomous Defense enabled'],
        enabled: store.state.autonomousDefense,
      },
      {
        id: 'host-isolation',
        name: 'Host Isolation',
        description: 'Manually quarantine a compromised endpoint through Wazuh Active Response (firewall-drop).',
        triggers: ['Analyst action on incident RESPONSE tab'],
        enabled: true,
      },
      {
        id: 'incident-lifecycle',
        name: 'Incident Lifecycle & Closure',
        description: 'New → Triage → Investigation → Containment → Eradication → Recovery → Resolved, with audit trail on every transition.',
        triggers: ['Alert correlation', 'Analyst status updates'],
        enabled: true,
      },
      {
        id: 'ai-triage',
        name: 'Paul AI Triage',
        description: 'On new incident, Gemini classifies severity/attack stage, extracts evidence and recommends next steps (non-blocking).',
        triggers: ['New incident'],
        enabled: !!(process.env.GEMINI_API_KEY || process.env.PAUL_AI_API_KEY),
      },
      {
        id: 'ioc-enrichment',
        name: 'Threat Intel IOC Enrichment',
        description: 'File hashes in events are checked against VirusTotal / AlienVault OTX; malicious hits are attached as IOCs.',
        triggers: ['Event with file_hash'],
        enabled: !!(process.env.VIRUSTOTAL_API_KEY || process.env.OTX_API_KEY),
      },
      {
        id: 'webhook-export',
        name: 'Webhook Export',
        description: 'HIGH/CRITICAL alerts and new incidents are pushed to the configured WEBHOOK_URL (Slack/Discord/SIEM).',
        triggers: ['New alert', 'New incident'],
        enabled: webhookConfigured(),
      },
    ]);
});

// --- Client-side diagnostics (temporary debug aid) ---
app.post("/api/debug/client-report", requireAuth, (req, res) => {
    try {
        logger.info('client_report', {
            user: (req as any).user?.email,
            ua: (req.headers['user-agent'] || '').slice(0, 120),
            origin: req.headers.origin || null,
            path: req.path,
            body: JSON.stringify(req.body || {}).slice(0, 500),
        });
    } catch (e) { /* ignore */ }
    res.json({ ok: true });
});

// Unauthenticated liveness/health probe for load balancers and uptime checks.
app.get("/api/health", (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        mode: store.state.mode,
    });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('express_error', { error: err?.message || String(err), path: req.path, stack: err?.stack });
    if (req.path.startsWith('/api/')) {
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    } else {
        next(err);
    }
});

// Boot-time integration health check: loudly reports which external systems
// are reachable/configured so an operator never mistakes a silent integration
// failure for a healthy system. Non-fatal — the app runs regardless.
async function checkIntegrations() {
  try {
    const agents = await getAgents();
    logger.info('integration_wazuh_connected', { agents: agents.length });
  } catch (e: any) {
    logger.warn('integration_wazuh_unavailable', { hint: 'Set WAZUH_API_URL / WAZUH_API_USERNAME / WAZUH_API_PASSWORD', error: e?.message || String(e) });
  }

  try {
    const client = getClient();
    await client.info();
    logger.info('integration_opensearch_connected', {});
  } catch (e: any) {
    logger.warn('integration_opensearch_unavailable', { hint: 'Set OPENSEARCH_URL / OPENSEARCH_ALERTS_INDEX', error: e?.message || String(e) });
  }

  if (process.env.GEMINI_API_KEY || process.env.PAUL_AI_API_KEY) {
    logger.info('integration_gemini_configured', { model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' });
  } else {
    logger.warn('integration_gemini_missing', { hint: 'Set GEMINI_API_KEY to enable Paul AI triage and chat' });
  }

  if (process.env.VIRUSTOTAL_API_KEY || process.env.OTX_API_KEY) {
    logger.info('integration_threatintel_configured', {});
  } else {
    logger.warn('integration_threatintel_missing', { hint: 'Set VIRUSTOTAL_API_KEY or OTX_API_KEY for IOC enrichment' });
  }

  if (process.env.INGEST_API_KEY) {
    logger.info('integration_ingest_key_configured', {});
  } else {
    logger.warn('integration_ingest_key_missing', { hint: 'Set INGEST_API_KEY so external forwarders can POST events' });
  }
}

async function startServer() {

  // Never cache anything in dev — a stale cached index.html or JS module is
  // exactly how an old (broken) bundle survives across fixes.
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    next();
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      // dev-only: allow any host (incl. preview proxies). HMR/ws disabled so
      // the middleware does not open an extra websocket port (24678) — the
      // preview should show exactly one port: the dashboard itself.
      server: { middlewareMode: true, allowedHosts: true, hmr: false, ws: false, watch: null },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, "0.0.0.0" as any, () => {
    logger.info('server_started', { port: PORT, env: process.env.NODE_ENV || 'development', mode: store.state.mode });
    // Non-blocking: report integration status after startup so it never
    // delays serving the dashboard.
    checkIntegrations().catch(e => logger.error('integration_check_failed', { error: e?.message || String(e) }));
  });
}

startServer();
