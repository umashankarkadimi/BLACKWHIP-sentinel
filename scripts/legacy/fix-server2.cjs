const fs = require('fs');

let server = fs.readFileSync('backend/server.ts', 'utf8');
server = server.replace(/i\.status !== 'RESOLVED' && i\.status !== 'RESOLVED'/g, "(i.status as string) !== 'CLOSED' && (i.status as string) !== 'RESOLVED'");
server = server.replace(/i\.status !== 'RESOLVED'/g, "(i.status as string) !== 'CLOSED' && (i.status as string) !== 'RESOLVED'");
fs.writeFileSync('backend/server.ts', server);

