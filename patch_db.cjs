const fs = require('fs');
let db = fs.readFileSync('backend/db.ts', 'utf8');

db = db.replace(/CREATE TABLE IF NOT EXISTS incidents \(/g, `CREATE TABLE IF NOT EXISTS incidents (`);
db = db.replace(/timeline TEXT,/g, `timeline TEXT,
    alerts TEXT,
    events TEXT,
    iocs TEXT,
    mitre_techniques TEXT,
    case_owner TEXT,
    case_notes TEXT,
    case_tasks TEXT,
    case_evidence TEXT,
    ai_analysis TEXT,`);

// We also need to run ALTER TABLE to add these columns to the existing SQLite DB to prevent crashes.
db += `
try {
  const columns = ['alerts', 'events', 'iocs', 'mitre_techniques', 'case_owner', 'case_notes', 'case_tasks', 'case_evidence', 'ai_analysis'];
  for (const col of columns) {
    try {
      db.exec(\`ALTER TABLE incidents ADD COLUMN \${col} TEXT\`);
    } catch (e) {
      // Column might already exist, ignore
    }
  }
} catch (e) {}
`;

fs.writeFileSync('backend/db.ts', db);
