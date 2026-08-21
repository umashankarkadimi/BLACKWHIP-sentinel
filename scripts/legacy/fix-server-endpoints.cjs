const fs = require('fs');
let code = fs.readFileSync('backend/server.ts', 'utf8');

// Update the eps interval to also fetch agents
code = code.replace(/setInterval\(\(\) => \{\n  store\.state\.eps = eventCount;\n  eventCount = 0;\n  eventBus\.emit\('state_update', store\.state\);\n\}, 1000\);/, `
setInterval(async () => {
  store.state.eps = eventCount;
  eventCount = 0;
  
  try {
     const agents = await getAgents();
     store.state.totalEndpoints = agents.length;
  } catch(e) {
     // Ignore wazuh error in background loop
  }

  eventBus.emit('state_update', store.state);
}, 2000); // 2 seconds to not spam wazuh too much
`);
fs.writeFileSync('backend/server.ts', code);
