import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { EventEmitter } from "events";
import { NormalizedEvent, Alert, Incident, SystemState, Severity } from "../frontend/src/types.js";
import { detectionRules } from "./rules.js";
import { lookupHash } from "./threatintel.js";
import { getAgents, isolateHost } from "./wazuh.js";
import { indexEvent, searchEvents } from "./opensearch.js";
import { db } from "./db.js";
import { startCollector } from "./services/wazuh-alert-collector.js";
import { interrogateAI, interrogateGlobalAI, runAIAnalysis } from "./ai.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
const PORT = parseInt(process.env.PORT || "3000", 10);
const eventBus = new EventEmitter();

process.on('unhandledRejection', (reason) => { console.error('[unhandledRejection]', reason); });
process.on('uncaughtException', (err) => { console.error('[uncaughtException]', err); });
eventBus.setMaxListeners(100);

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

setInterval(async () => {
  store.state.eps = Math.round(eventCount / 2);
  eventCount = 0;
  try {
     const agents = await getAgents();
     store.state.totalEndpoints = agents.length;
  } catch(e) {}
  eventBus.emit('state_update', store.state);
}, 2000);

function saveIncidentToDb(inc: Incident) {
    try {
        db.prepare(`INSERT INTO incidents (id, title, severity, status, affected_assets, created_at, resolved_at, alerts, events, iocs, mitre_techniques, case_owner, case_notes, case_tasks, case_evidence, ai_analysis)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET 
                        title=excluded.title, severity=excluded.severity, status=excluded.status, 
                        affected_assets=excluded.affected_assets, resolved_at=excluded.resolved_at,
                        alerts=excluded.alerts, events=excluded.events, iocs=excluded.iocs,
                        mitre_techniques=excluded.mitre_techniques, case_owner=excluded.case_owner,
                        case_notes=excluded.case_notes, case_tasks=excluded.case_tasks,
                        case_evidence=excluded.case_evidence, ai_analysis=excluded.ai_analysis`)
          .run(inc.incident_id, inc.title, inc.severity, inc.status, JSON.stringify(inc.affected_assets || []), 
               inc.created_at, inc.status === 'RESOLVED' ? inc.updated_at : null,
               JSON.stringify(inc.alerts || []), JSON.stringify(inc.events || []), JSON.stringify(inc.iocs || []),
               JSON.stringify(inc.mitre_techniques || []), inc.case_owner || null,
               JSON.stringify(inc.case_notes || []), JSON.stringify(inc.case_tasks || []),
               JSON.stringify(inc.case_evidence || []), JSON.stringify(inc.ai_analysis || null));
    } catch(e) { console.error('DB write error', e); }
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
         confidence: 1
      };
    }) as Incident[];
    store.state.activeIncidents = store.incidents.filter((i: Incident) => (i.status as string) !== 'CLOSED' && (i.status as string) !== 'RESOLVED').length;
  } catch (e) {
    console.error("Failed to load incidents:", e);
  }
}
loadIncidents();

startCollector((event) => {
    try { ingestEvent(event); } catch(e) {}
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

  store.events.unshift(normalized);
  if (store.events.length > 500) store.events.pop();
  eventHistory.push(normalized);
  if (eventHistory.length > 1000) eventHistory.shift();

  eventBus.emit('new_event', normalized);
  evaluateRules(normalized);
}

async function evaluateRules(event: NormalizedEvent) {
  for (const rule of detectionRules as any[]) {
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
      if (store.alerts.length > 500) store.alerts.pop();

      if (alert.severity === 'HIGH' || alert.severity === 'CRITICAL') {
        store.state.highAlerts++;
      }

      eventBus.emit('new_alert', alert);
      const incident = await correlateAlert(alert);
      
      if (store.state.autonomousDefense && (rule.severity === 'HIGH' || rule.severity === 'CRITICAL')) {
         if (event.hostname) {
             const result = await isolateHost(event.hostname);
             try {
                db.prepare(`INSERT INTO audit_logs (id, timestamp, action, user_email, details) VALUES (?, ?, ?, ?, ?)`)
                  .run(uuidv4(), new Date().toISOString(), "AUTONOMOUS_DEFENSE_ISOLATE", "System-SOAR", JSON.stringify({ target: event.hostname, result }));
             } catch(e) { console.error(e); }

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
  
  const now = Date.now();
  let incident = store.incidents.find((i: Incident) => {
     if (i.status === 'RESOLVED' || i.status === 'CLOSED') return false;
     if (!i.affected_assets.includes(targetHost)) return false;
     const ageMs = now - new Date(i.created_at).getTime();
     return ageMs < 24 * 3600 * 1000;
  });

  if (incident) {
    incident.alerts.push(alert);
    incident.events.push(event);
    if (!incident.mitre_techniques.includes(alert.mitre_technique!)) {
        incident.mitre_techniques.push(alert.mitre_technique!);
    }
    if (event.username && !incident.affected_users.includes(event.username)) {
        incident.affected_users.push(event.username);
    }
    incident.updated_at = new Date().toISOString();
    
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
    store.state.activeIncidents++;
    
    saveIncidentToDb(incident);
    eventBus.emit('new_incident', incident);

    // Real AI triage (Paul) — async, non-blocking; enriches the incident when it returns
    runAIAnalysis(incident).then(analysis => {
      incident.ai_analysis = analysis;
      if (analysis.severity) incident.severity = analysis.severity as Severity;
      incident.updated_at = new Date().toISOString();
      saveIncidentToDb(incident);
      eventBus.emit('incident_updated', incident);
    }).catch(err => console.error('AI triage failed:', err));
  }

  if (event.file_hash) {
      const result = await lookupHash(event.file_hash);
      if (result.malicious) {
          incident.iocs.push({ type: 'hash', value: event.file_hash, malicious: true, source: result.source });
          saveIncidentToDb(incident);
          eventBus.emit('incident_updated', incident);
      }
  }
  return incident;
}

const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.split(' ')[1];
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: "Server misconfiguration" });
    const decoded = jwt.verify(token, secret);
    (req as any).user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

const requireAnalyst = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Basic RBAC - just checks if authenticated for now since default role is ANALYST
    if (!(req as any).user) return res.status(401).json({ error: "Unauthorized" });
    next();
};

const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if ((req as any).user?.role !== 'ADMIN' && (req as any).user?.role !== 'ROOT') {
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

app.post("/api/state/mode", requireAuth, requireAnalyst, (req, res) => {
  const { mode } = req.body || {};
  if (mode !== 'LIVE' && mode !== 'SIMULATION') {
    return res.status(400).json({ error: "mode must be 'LIVE' or 'SIMULATION'" });
  }
  store.state.mode = mode;
  try {
    db.prepare(`INSERT INTO audit_logs (id, timestamp, action, user_email, details) VALUES (?, ?, ?, ?, ?)`)
      .run(uuidv4(), new Date().toISOString(), "SET_MODE", (req as any).user.email, JSON.stringify({ mode }));
  } catch(e) { console.error(e); }
  eventBus.emit('state_update', store.state);
  res.json({ success: true, mode: store.state.mode });
});

app.post("/api/state/defense", requireAuth, requireAnalyst, (req, res) => {
  const { active } = req.body;
  store.state.autonomousDefense = active;
  try {
      db.prepare(`INSERT INTO audit_logs (id, timestamp, action, user_email, details) VALUES (?, ?, ?, ?, ?)`)
        .run(uuidv4(), new Date().toISOString(), "UPDATE_SOAR_CONFIG", (req as any).user.email, JSON.stringify({ active }));
  } catch(e) { console.error(e); }
  eventBus.emit('state_update', store.state);
  res.json({ success: true, autonomousDefense: store.state.autonomousDefense });
});

app.post("/api/incidents/:id/action", requireAuth, requireAnalyst, async (req, res) => {
  const { action, payload } = req.body;
  const incident = store.incidents.find(i => i.incident_id === req.params.id);
  if (!incident) return res.status(404).json({ error: "Incident not found" });

  if (action === 'UPDATE_STATUS') {
    incident.status = payload.status;
    if (payload.status === 'RESOLVED' || payload.status === 'CLOSED') {
      store.state.activeIncidents = Math.max(0, store.state.activeIncidents - 1);
    }
  } else if (action === 'CASE_UPDATE') {
    if (payload.case_owner) incident.case_owner = payload.case_owner;
    if (payload.case_notes) incident.case_notes = payload.case_notes;
    if (payload.case_tasks) incident.case_tasks = payload.case_tasks;
    if (payload.case_evidence) incident.case_evidence = payload.case_evidence;
  } else if (action === 'ISOLATE_HOST') {
    let targetAgentId = payload.hostname;
    try {
        const agents = await getAgents();
        const agent = agents.find(a => a.name === payload.hostname);
        if (agent && agent.id) targetAgentId = agent.id;
    } catch(e) {}
    const result = await isolateHost(targetAgentId);
    if (result.status === 'SUCCESS') {
        try {
            db.prepare(`INSERT INTO audit_logs (id, timestamp, action, user_email, details) VALUES (?, ?, ?, ?, ?)`)
              .run(uuidv4(), new Date().toISOString(), "ISOLATE_HOST_SUCCESS", (req as any).user.email, JSON.stringify(result));
        } catch(e) { console.error(e); }
        res.json({ success: true, result });
        return;
    } else {
        return res.status(500).json(result);
    }
  }
  
  saveIncidentToDb(incident);

  try {
        db.prepare(`INSERT INTO audit_logs (id, timestamp, action, user_email, details) VALUES (?, ?, ?, ?, ?)`)
          .run(uuidv4(), new Date().toISOString(), `INCIDENT_${action}`, (req as any).user.email, JSON.stringify({ incident: incident.incident_id }));
  } catch(e) { console.error(e); }

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
    } catch(e){}
    
    try {
        const { getClient } = require('./opensearch.js');
        const client = getClient();
        await client.info();
        openSearchStatus = "CONNECTED";
    } catch(e) {}
    
    res.json({
        wazuh: wazuhStatus,
        opensearch: openSearchStatus,
        threatLevel: store.state.threatLevel
    });
});

app.post("/api/chat", requireAuth, requireAnalyst, async (req, res) => {
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

app.post("/api/chat/global", requireAuth, requireAnalyst, async (req, res) => {
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
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: 'JWT_SECRET missing in server configuration' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    // Constant-ish response to avoid user enumeration
    if (!user || !user.password_hash) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ uid: user.id, email: user.email, role: user.role }, secret, { expiresIn: '8h' });
    try {
        db.prepare(`INSERT INTO audit_logs (id, timestamp, action, user_email, details) VALUES (?, ?, ?, ?, ?)`)
          .run(uuidv4(), new Date().toISOString(), "LOGIN", user.email, JSON.stringify({ ip: req.ip }));
    } catch(e) { console.error(e); }
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
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

// Remove generic unauthenticated /api/audit POST endpoint for security
// Actions are now audited directly within their respective handlers.

app.get("/api/events", requireAuth, (req, res) => res.json(store.events.slice(0, 100)));

app.get("/api/events/search", requireAuth, async (req, res) => {
  const q = req.query.q as string || '';
  try {
      const results = await searchEvents(q);
      res.json(results);
  } catch(e: any) {
      res.status(503).json({ error: e.message });
  }
});

app.get("/api/rules", requireAuth, (req, res) => res.json(detectionRules));
app.get("/api/alerts", requireAuth, (req, res) => res.json(store.alerts.slice(0, 100)));
app.get("/api/incidents", requireAuth, (req, res) => res.json(store.incidents));

app.get("/api/incidents/:id", requireAuth, (req, res) => {
  const incident = store.incidents.find(i => i.incident_id === req.params.id);
  if (incident) res.json(incident);
  else res.status(404).json({ error: "Not found" });
});

// SSE Endpoint
app.get("/api/stream", (req, res) => {
  const token = req.query.token as string;
  if (!token) return res.status(401).end();
  try {
      const secret = process.env.JWT_SECRET;
      if (!secret) return res.status(500).end();
      jwt.verify(token, secret);
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


app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Express Error:", err);
    if (req.path.startsWith('/api/')) {
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    } else {
        next(err);
    }
});

async function startServer() {

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, "0.0.0.0" as any, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
