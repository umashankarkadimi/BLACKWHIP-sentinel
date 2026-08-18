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

  // Change backgrounds to Black
  content = content.replace(/bg-white/g, 'bg-black');
  content = content.replace(/bg-neutral-50/g, 'bg-black');
  
  // Make sure text is visible (change dark text to light text)
  content = content.replace(/text-neutral-900/g, 'text-neutral-50');
  content = content.replace(/text-neutral-800/g, 'text-neutral-200');
  content = content.replace(/text-neutral-700/g, 'text-neutral-300');
  // leave neutral-600/500/400 alone as they are gray

  fs.writeFileSync(file, content, 'utf8');
});
