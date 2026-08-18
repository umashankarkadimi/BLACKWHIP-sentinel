const fs = require('fs');
let server = fs.readFileSync('backend/server.ts', 'utf8');
if (!server.includes('/api/audit')) {
    server = server.replace(
        /\/\/ Data endpoints/g,
        `// Data endpoints
app.get("/api/audit", async (req, res) => {
    if (!db) return res.json([]);
    try {
        const snap = await db.collection('audit_logs').orderBy('timestamp', 'desc').limit(50).get();
        res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.post("/api/audit", async (req, res) => {
    if (!db) return res.json({ success: true });
    try {
        await db.collection('audit_logs').add(req.body);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
`
    );
    fs.writeFileSync('backend/server.ts', server);
}

let auditTs = fs.readFileSync('frontend/src/lib/audit.ts', 'utf8');
auditTs = `export async function logAudit(userId: string, userEmail: string, action: string, details: any) {
  try {
    await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timestamp: new Date().toISOString(), userId, userEmail, action, details })
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}`;
fs.writeFileSync('frontend/src/lib/audit.ts', auditTs);

let auditPanel = fs.readFileSync('frontend/src/components/AuditLogsPanel.tsx', 'utf8');
auditPanel = auditPanel.replace(/import \{ db \} from '\.\.\/lib\/firebase';/g, '');
auditPanel = auditPanel.replace(/import \{ collection, query, orderBy, limit, getDocs \} from 'firebase\/firestore';/g, '');
auditPanel = auditPanel.replace(/const q = query\(collection\(db, 'audit_logs'\), orderBy\('timestamp', 'desc'\), limit\(50\)\);\s*const snap = await getDocs\(q\);\s*const fetchedLogs = snap\.docs\.map\(doc => \(\{ id: doc\.id, \.\.\.doc\.data\(\) \}\)\);/g, `const res = await fetch('/api/audit');\n        const fetchedLogs = await res.json();`);
fs.writeFileSync('frontend/src/components/AuditLogsPanel.tsx', auditPanel);

