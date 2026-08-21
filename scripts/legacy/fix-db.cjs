const fs = require('fs');
let code = fs.readFileSync('backend/db.ts', 'utf8');

if (!code.includes("INSERT OR IGNORE INTO users")) {
    code += `
// Seed initial user
try {
  db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)').run(
    '00000000-0000-0000-0000-000000000000',
    'analyst@lab.local',
    'seed_hash',
    'ANALYST'
  );
} catch(e) { console.error("Error seeding user", e); }
`;
    fs.writeFileSync('backend/db.ts', code);
}
