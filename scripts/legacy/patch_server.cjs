const fs = require('fs');
let server = fs.readFileSync('backend/server.ts', 'utf8');

server = server.replace(/import \{ interrogateAI, interrogateGlobalAI \} from '\.\/ai\.js';/g, `import { interrogateAI, interrogateGlobalAI } from './ai.js';\nimport { startCollector } from './services/wazuh-alert-collector.js';`);

server = server.replace(/loadIncidents\(\);/g, `loadIncidents();\n\nstartCollector((event) => {\n    try { ingestEvent(event); } catch(e) {}\n});`);

fs.writeFileSync('backend/server.ts', server);
