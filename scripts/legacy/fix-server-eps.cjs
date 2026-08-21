const fs = require('fs');
let code = fs.readFileSync('backend/server.ts', 'utf8');

code = code.replace(/store\.state\.eps = eventCount;/, 'store.state.eps = Math.round(eventCount / 2);');
fs.writeFileSync('backend/server.ts', code);
