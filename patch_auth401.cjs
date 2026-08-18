const fs = require('fs');

let server = fs.readFileSync('backend/server.ts', 'utf8');
server = server.replace(/res\.status\(403\)\.json\(\{ error: 'User not found in DB' \}\)/g, `res.status(401).json({ error: 'User not found in DB' })`);
server = server.replace(/res\.status\(403\)\.json\(\{ error: 'Invalid token' \}\)/g, `res.status(401).json({ error: 'Invalid token' })`);
fs.writeFileSync('backend/server.ts', server);
