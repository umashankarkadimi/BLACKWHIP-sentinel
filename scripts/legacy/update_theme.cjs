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

const replacements = [
  // text colors
  { pattern: /text-stone-900/g, replacement: 'text-slate-50' },
  { pattern: /text-stone-800/g, replacement: 'text-slate-200' },
  { pattern: /text-stone-700/g, replacement: 'text-slate-300' },
  { pattern: /text-stone-600/g, replacement: 'text-slate-400' },
  { pattern: /text-stone-500/g, replacement: 'text-slate-400' },
  { pattern: /text-stone-400/g, replacement: 'text-slate-500' },
  { pattern: /text-stone-300/g, replacement: 'text-slate-600' },
  
  { pattern: /text-red-700/g, replacement: 'text-fuchsia-400' },
  { pattern: /text-red-600/g, replacement: 'text-violet-400' },
  
  // bg colors
  { pattern: /bg-\[\#FDFBF7\]/g, replacement: 'bg-[#0f172a]' },
  { pattern: /bg-white\/90/g, replacement: 'bg-[#1e293b]\/90' },
  { pattern: /bg-white\/50/g, replacement: 'bg-[#1e293b]\/50' },
  { pattern: /bg-white/g, replacement: 'bg-[#1e293b]' },
  
  { pattern: /bg-stone-50\/50/g, replacement: 'bg-[#0f172a]\/50' },
  { pattern: /bg-stone-50/g, replacement: 'bg-[#0f172a]\/80' },
  { pattern: /bg-stone-100/g, replacement: 'bg-[#0f172a]' },
  
  { pattern: /bg-red-50\/50/g, replacement: 'bg-fuchsia-950\/30' },
  { pattern: /bg-red-50/g, replacement: 'bg-fuchsia-950\/40' },
  { pattern: /bg-red-100/g, replacement: 'bg-fuchsia-900\/40' },
  { pattern: /bg-red-200/g, replacement: 'bg-fuchsia-900\/60' },
  
  { pattern: /bg-red-500/g, replacement: 'bg-fuchsia-500' },
  { pattern: /bg-red-600/g, replacement: 'bg-violet-500' },
  
  // borders
  { pattern: /border-stone-200/g, replacement: 'border-violet-500\/20' },
  { pattern: /border-stone-300/g, replacement: 'border-violet-500\/30' },
  { pattern: /border-red-200/g, replacement: 'border-fuchsia-500\/30' },
  { pattern: /border-red-300/g, replacement: 'border-fuchsia-500\/40' },
  { pattern: /border-red-500/g, replacement: 'border-fuchsia-500' },
  
  // prose
  { pattern: /prose-stone/g, replacement: 'prose-invert prose-fuchsia' },
  
  // hex colors in dashboard/graphs
  { pattern: /#b91c1c/g, replacement: '#d946ef' }, // fuchsia-500
  { pattern: /#78350f/g, replacement: '#fdf4ff' }, // fuchsia-50
  { pattern: /rgba\(185, 28, 28/g, replacement: 'rgba(217, 70, 239' }, // fuchsia-500 RGB
  { pattern: /via-red-300/g, replacement: 'via-fuchsia-500' },
  
  // Update glows
  { pattern: /rgba\(239, 68, 68, 0\.2\)/g, replacement: 'rgba(244, 63, 94, 0.4)' },
  { pattern: /rgba\(249, 115, 22, 0\.2\)/g, replacement: 'rgba(249, 115, 22, 0.4)' },
  { pattern: /rgba\(234, 179, 8, 0\.2\)/g, replacement: 'rgba(234, 179, 8, 0.4)' },
  { pattern: /rgba\(59, 130, 246, 0\.2\)/g, replacement: 'rgba(59, 130, 246, 0.4)' },
  { pattern: /rgba\(16, 185, 129, 0\.2\)/g, replacement: 'rgba(16, 185, 129, 0.4)' }
];

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    replacements.forEach(rep => {
      content = content.replace(rep.pattern, rep.replacement);
    });
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
