import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(path.join(dataDir, 'soc.db'));

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password_hash TEXT,
    role TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    title TEXT,
    severity TEXT,
    status TEXT,
    affected_assets TEXT,
    timeline TEXT,
    alerts TEXT,
    events TEXT,
    iocs TEXT,
    mitre_techniques TEXT,
    case_owner TEXT,
    case_notes TEXT,
    case_tasks TEXT,
    case_evidence TEXT,
    ai_analysis TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT,
    user_email TEXT,
    action TEXT,
    details TEXT
  );
`);

// Seed initial user
try {
  db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)').run(
    '00000000-0000-0000-0000-000000000000',
    'analyst@lab.local',
    'seed_hash',
    'ANALYST'
  );
} catch(e) { console.error("Error seeding user", e); }

try {
  const columns = ['alerts', 'events', 'iocs', 'mitre_techniques', 'case_owner', 'case_notes', 'case_tasks', 'case_evidence', 'ai_analysis'];
  for (const col of columns) {
    try {
      db.exec(`ALTER TABLE incidents ADD COLUMN ${col} TEXT`);
    } catch (e) {
      // Column might already exist, ignore
    }
  }
} catch (e) {}
