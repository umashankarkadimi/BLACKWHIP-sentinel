const fs = require('fs');
let server = fs.readFileSync('backend/server.ts', 'utf8');

server = server.replace(/const result = await isolateHost\(payload\.hostname\);/g, `
    let targetAgentId = payload.hostname;
    try {
        const agents = await getAgents();
        const agent = agents.find(a => a.name === payload.hostname);
        if (agent && agent.id) targetAgentId = agent.id;
    } catch(e) {}
    const result = await isolateHost(targetAgentId);
`);

fs.writeFileSync('backend/server.ts', server);
