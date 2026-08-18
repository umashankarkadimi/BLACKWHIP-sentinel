const fs = require('fs');
let server = fs.readFileSync('backend/server.ts', 'utf8');

server = server.replace(/store\.incidents = rows\.map\(\(r: any\) => \(\{\n\s+\.\.\.r,\n\s+alerts: \[\],\n\s+events: \[\],\n\s+affected_assets: r\.affected_assets \? JSON\.parse\(r\.affected_assets\) : \[\],\n\s+affected_users: \[\],\n\s+iocs: \[\],\n\s+mitre_techniques: \[\]\n\s+\}\)\) as Incident\[\];/g, `store.incidents = rows.map((r: any) => {
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
    }) as Incident[];`);

fs.writeFileSync('backend/server.ts', server);
