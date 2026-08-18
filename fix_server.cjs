const fs = require('fs');

const current = fs.readFileSync('backend/server.ts', 'utf8');
const bottomPart = current.substring(current.indexOf('app.post("/api/chat"'));

const topPart = `import express from "express";
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
import { interrogateAI, interrogateGlobalAI } from "./ai.js";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
const PORT = parseInt(process.env.PORT || "3000", 10);
const eventBus = new EventEmitter();
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
        db.prepare(\`INSERT INTO incidents (id, title, severity, status, affected_assets, created_at, resolved_at, alerts, events, iocs, mitre_techniques, case_owner, case_notes, case_tasks, case_evidence, ai_analysis)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET 
                        title=excluded.title, severity=excluded.severity, status=excluded.status, 
                        affected_assets=excluded.affected_assets, resolved_at=excluded.resolved_at,
                        alerts=excluded.alerts, events=excluded.events, iocs=excluded.iocs,
                        mitre_techniques=excluded.mitre_techniques, case_owner=excluded.case_owner,
                        case_notes=excluded.case_notes, case_tasks=excluded.case_tasks,
                        case_evidence=excluded.case_evidence, ai_analysis=excluded.ai_analysis\`)
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

  await indexEvent(normalized);

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
                db.prepare(\`INSERT INTO audit_logs (id, timestamp, action, user_email, details) VALUES (?, ?, ?, ?, ?)\`)
                  .run(uuidv4(), new Date().toISOString(), "AUTONOMOUS_DEFENSE_ISOLATE", "System-SOAR", JSON.stringify({ target: event.hostname, result }));
             } catch(e) { console.error(e); }

             if (incident && result.status === 'SUCCESS') {
                 incident.status = 'CONTAINMENT';
                 if (!incident.case_notes) incident.case_notes = [];
                 incident.case_notes.push({
                     timestamp: new Date().toISOString(),
                     author: 'SOAR-Bot',
                     content: \`Executed Auto-Containment playbook. Isolated host \${event.hostname} via Wazuh. Status: SUCCESS.\`
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
    const incId = \`INC-\${new Date().getFullYear()}-\${Math.floor(100000 + Math.random() * 900000)}\`;
    incident = {
      incident_id: incId,
      title: \`Suspicious Activity on \${targetHost}\`,
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

app.post("/api/state/defense", requireAuth, requireAnalyst, (req, res) => {
  const { active } = req.body;
  store.state.autonomousDefense = active;
  try {
      db.prepare(\`INSERT INTO audit_logs (id, timestamp, action, user_email, details) VALUES (?, ?, ?, ?, ?)\`)
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
            db.prepare(\`INSERT INTO audit_logs (id, timestamp, action, user_email, details) VALUES (?, ?, ?, ?, ?)\`)
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
        db.prepare(\`INSERT INTO audit_logs (id, timestamp, action, user_email, details) VALUES (?, ?, ?, ?, ?)\`)
          .run(uuidv4(), new Date().toISOString(), \`INCIDENT_\${action}\`, (req as any).user.email, JSON.stringify({ incident: incident.incident_id }));
  } catch(e) { console.error(e); }

  eventBus.emit('incident_updated', incident);
  eventBus.emit('state_update', store.state);
  res.json({ success: true, incident });
});
`;

fs.writeFileSync('backend/server.ts', topPart + "\n" + bottomPart);
