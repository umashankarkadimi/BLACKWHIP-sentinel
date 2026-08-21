#!/usr/bin/env node
/**
 * BlackWhip SentinelX — SQLite backup.
 *
 * Copies data/soc.db to backups/ with a timestamp, using SQLite's online
 * backup API (safe to run while the server is live).
 *
 * Usage: npm run db:backup
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(ROOT, 'data', 'soc.db');
const BACKUP_DIR = path.join(ROOT, 'backups');

if (!fs.existsSync(DB_PATH)) {
  console.error('No database found at data/soc.db — nothing to back up.');
  process.exit(1);
}
fs.mkdirSync(BACKUP_DIR, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dest = path.join(BACKUP_DIR, `soc-${stamp}.db`);

const src = new Database(DB_PATH, { readonly: true });
src.backup(dest).then(() => {
  src.close();
  const size = fs.statSync(dest).size;
  console.log(`Backup written: ${path.relative(ROOT, dest)} (${(size / 1024).toFixed(1)} KB)`);
}).catch(e => {
  src.close();
  console.error('Backup failed:', e.message);
  process.exit(1);
});
