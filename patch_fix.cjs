const fs = require('fs');
let server = fs.readFileSync('backend/server.ts', 'utf8');

const regex = /\/\/ Load existing incidents from DB on startup.*?async function correlateAlert/s;

const replacement = `// Load existing incidents from DB on startup
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

async function correlateAlert`;

server = server.replace(regex, replacement);

fs.writeFileSync('backend/server.ts', server);
