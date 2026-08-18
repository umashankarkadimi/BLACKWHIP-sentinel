const fs = require('fs');
const path = require('path');

const files = [
  'frontend/src/App.tsx',
  'frontend/src/components/TopBar.tsx',
  'frontend/src/components/Dashboard.tsx',
  'frontend/src/components/IncidentView.tsx',
  'frontend/src/components/EventFeed.tsx',
  'frontend/src/components/GlobalChat.tsx',
  'frontend/src/components/AttackGraph.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // Replace all #111111 with black
  content = content.replace(/#111111/g, 'black');

  fs.writeFileSync(file, content, 'utf8');
});
