import 'dotenv/config';

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { logger } from './logger.js';

// DATA_DIR override lets tests/backups use an isolated database so they never
// touch the live app's data (default: <cwd>/data).
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
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

  CREATE TABLE IF NOT EXISTS events (
    event_id TEXT PRIMARY KEY,
    timestamp TEXT,
    source TEXT,
    source_type TEXT,
    hostname TEXT,
    event_type TEXT,
    event_category TEXT,
    severity TEXT,
    rule_id TEXT,
    rule_name TEXT,
    username TEXT,
    process_name TEXT,
    command_line TEXT,
    src_ip TEXT,
    dst_ip TEXT,
    file_hash TEXT,
    mitre_tactic TEXT,
    mitre_technique TEXT,
    raw_event TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_events_hostname ON events(hostname);
  CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);

  CREATE TABLE IF NOT EXISTS rules (
    rule_id TEXT PRIMARY KEY,
    description TEXT,
    mitre_tactic TEXT,
    mitre_technique TEXT,
    severity TEXT,
    enabled INTEGER DEFAULT 1,
    condition TEXT
  );
`);

// Seed / update the first admin user from environment (bcrypt-hashed).
try {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const hash = bcrypt.hashSync(adminPassword, 10);
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail) as any;
    if (existing) {
      db.prepare('UPDATE users SET password_hash = ?, role = ? WHERE email = ?').run(hash, 'ADMIN', adminEmail);
    } else {
      db.prepare('INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)').run(
        randomUUID(), adminEmail, hash, 'ADMIN'
      );
    }
    logger.info('admin_user_ready', { email: adminEmail });
  } else {
    logger.warn('admin_user_not_seeded', { reason: 'ADMIN_EMAIL / ADMIN_PASSWORD not set' });
  }
} catch(e: any) { logger.error('admin_seed_failed', { error: e?.message || String(e) }); }

try {
  const columns = ['alerts', 'events', 'iocs', 'mitre_techniques', 'case_owner', 'case_notes', 'case_tasks', 'case_evidence', 'ai_analysis', 'blocked_ips'];
  for (const col of columns) {
    try {
      db.exec(`ALTER TABLE incidents ADD COLUMN ${col} TEXT`);
    } catch (e) {
      // Column might already exist, ignore
    }
  }
} catch (e) {}
