const fs = require('fs');

// 1. Fix OpenSearch
let os = fs.readFileSync('backend/opensearch.ts', 'utf8');
os = os.replace(/"order": "desc"/g, '"order": "desc" as any'); // Bypass type error
fs.writeFileSync('backend/opensearch.ts', os);

// 2. Fix frontend types
let types = fs.readFileSync('frontend/src/types.ts', 'utf8');
types = types.replace(/'ERADICATION' \| 'RECOVERY'/, "'ERADICATION' | 'RECOVERY' | 'CLOSED' | 'RESOLVED'");
fs.writeFileSync('frontend/src/types.ts', types);

// 3. Fix server.ts (291)
let server = fs.readFileSync('backend/server.ts', 'utf8');
// No need to fix server.ts since we added CLOSED and RESOLVED to types.ts, so the overlap error will disappear. Wait, server.ts imports from frontend/src/types? Let's check server.ts imports.
