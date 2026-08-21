const fs = require('fs');

// 1. Fix TopBar.tsx
let topbar = fs.readFileSync('frontend/src/components/TopBar.tsx', 'utf8');
topbar = topbar.replace(/<div className="relative group">\s*<button\s*disabled=\{injecting\}[\s\S]*?WARGAMES INJECTOR[\s\S]*?<\/div>\s*<\/div>/, '');
topbar = topbar.replace(/const \[injecting, setInjecting\] = useState\(false\);/, '');
fs.writeFileSync('frontend/src/components/TopBar.tsx', topbar);

// 2. Fix OpenSearch.ts
let os = fs.readFileSync('backend/opensearch.ts', 'utf8');
os = os.replace(/sort: \[ { '@timestamp': { order: 'desc' } } \]/g, 'sort: [ { "@timestamp": { order: "desc" as const } } ]');
fs.writeFileSync('backend/opensearch.ts', os);

// 3. Fix server.ts
let server = fs.readFileSync('backend/server.ts', 'utf8');
server = server.replace(/i\.status !== 'CLOSED'/g, "i.status !== 'RESOLVED'");
server = server.replace(/const row = db\.prepare\('SELECT \*\s*FROM incidents WHERE id = \?'\)\.get\(incident_id\);/g, "const row = db.prepare('SELECT * FROM incidents WHERE id = ?').get(incident_id) as any;");
// 4. Fix express listen port
server = server.replace(/const PORT = process\.env\.PORT \|\| 3000;/, 'const PORT = parseInt(process.env.PORT || "3000", 10);');

fs.writeFileSync('backend/server.ts', server);

