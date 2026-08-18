const fs = require('fs');

let code = fs.readFileSync('frontend/src/workflows/WorkflowSimulator.tsx', 'utf8');
code = code.replace(/'Launch Live Simulation'/g, "'Start Simulation'");
fs.writeFileSync('frontend/src/workflows/WorkflowSimulator.tsx', code);
