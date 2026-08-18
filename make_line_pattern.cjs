const fs = require('fs');

let dashboard = fs.readFileSync('frontend/src/components/Dashboard.tsx', 'utf8');

// Change dot pattern to grid pattern (line drawing)
dashboard = dashboard.replace(/radial-gradient\([^)]+\)/g, 'linear-gradient(rgba(239, 68, 68, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(239, 68, 68, 0.15) 1px, transparent 1px)');

// Make it straight linear lines instead of stepAfter
dashboard = dashboard.replace(/type="stepAfter"/g, 'type="linear"');

fs.writeFileSync('frontend/src/components/Dashboard.tsx', dashboard, 'utf8');

let attack = fs.readFileSync('frontend/src/components/AttackGraph.tsx', 'utf8');
attack = attack.replace(/background: '\#09090b'/g, "background: 'transparent'");
attack = attack.replace(/border: '1px solid \#1a1a1a'/g, "border: '2px dashed #f97316'");

// Update Edge style
attack = attack.replace(/style: \{ stroke: '\#ef4444' \}/g, "style: { stroke: '#ef4444', strokeDasharray: '5 5' }");

fs.writeFileSync('frontend/src/components/AttackGraph.tsx', attack, 'utf8');
