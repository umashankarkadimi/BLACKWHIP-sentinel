const fs = require('fs');

// 1. Fix trust proxy in server.ts
let server = fs.readFileSync('backend/server.ts', 'utf8');
if (!server.includes("app.set('trust proxy'")) {
    server = server.replace('const app = express();', "const app = express();\napp.set('trust proxy', 1);");
}
fs.writeFileSync('backend/server.ts', server);

// 2. Silence/improve the Wazuh logging in wazuh.ts
let wazuh = fs.readFileSync('backend/wazuh.ts', 'utf8');
wazuh = wazuh.replace('console.error("[Wazuh] Error getting agents:", e.message);', '// console.error("[Wazuh] Error getting agents:", e.message); // Silenced to avoid spamming logs when disconnected');
fs.writeFileSync('backend/wazuh.ts', wazuh);
