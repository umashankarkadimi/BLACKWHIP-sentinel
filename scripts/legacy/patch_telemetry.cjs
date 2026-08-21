const fs = require('fs');
let server = fs.readFileSync('backend/server.ts', 'utf8');

const telemetryRoute = `
app.get("/api/state/telemetry", requireAuth, async (req, res) => {
    let wazuhStatus = "OFFLINE";
    let openSearchStatus = "OFFLINE";
    
    try {
       await getAgents();
       wazuhStatus = "CONNECTED";
    } catch(e){}
    
    try {
        const { getClient } = require('./opensearch.js');
        const client = getClient();
        await client.info();
        openSearchStatus = "CONNECTED";
    } catch(e) {}
    
    res.json({
        wazuh: wazuhStatus,
        opensearch: openSearchStatus,
        threatLevel: store.state.threatLevel
    });
});
`;

server = server.replace(/app\.post\("\/api\/chat", requireAuth/g, telemetryRoute + "\napp.post(\"/api/chat\", requireAuth");

fs.writeFileSync('backend/server.ts', server);
