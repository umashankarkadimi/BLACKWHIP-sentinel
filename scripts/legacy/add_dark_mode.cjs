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
  { pattern: /\btext-slate-50\b/g, replacement: 'text-slate-900 dark:text-slate-50' },
  { pattern: /\btext-slate-200\b/g, replacement: 'text-slate-800 dark:text-slate-200' },
  { pattern: /\btext-slate-300\b/g, replacement: 'text-slate-700 dark:text-slate-300' },
  { pattern: /\btext-slate-400\b/g, replacement: 'text-slate-600 dark:text-slate-400' },
  { pattern: /\btext-slate-600\b/g, replacement: 'text-slate-400 dark:text-slate-600' },
  { pattern: /\btext-fuchsia-400\b/g, replacement: 'text-fuchsia-700 dark:text-fuchsia-400' },
  { pattern: /\btext-violet-400\b/g, replacement: 'text-violet-700 dark:text-violet-400' },
  
  // bg colors
  { pattern: /\bbg-\[\#0f172a\]\b(?![\/])/g, replacement: 'bg-[#FDFBF7] dark:bg-[#0f172a]' },
  { pattern: /\bbg-\[\#1e293b\]\/90\b/g, replacement: 'bg-white/90 dark:bg-[#1e293b]/90' },
  { pattern: /\bbg-\[\#1e293b\]\/50\b/g, replacement: 'bg-white/50 dark:bg-[#1e293b]/50' },
  { pattern: /\bbg-\[\#1e293b\]\b/g, replacement: 'bg-white dark:bg-[#1e293b]' },
  
  { pattern: /\bbg-\[\#0f172a\]\/50\b/g, replacement: 'bg-slate-50/50 dark:bg-[#0f172a]/50' },
  { pattern: /\bbg-\[\#0f172a\]\/80\b/g, replacement: 'bg-slate-50 dark:bg-[#0f172a]/80' },
  
  { pattern: /\bbg-fuchsia-950\/30\b/g, replacement: 'bg-fuchsia-50/50 dark:bg-fuchsia-950/30' },
  { pattern: /\bbg-fuchsia-950\/40\b/g, replacement: 'bg-fuchsia-50 dark:bg-fuchsia-950/40' },
  { pattern: /\bbg-fuchsia-900\/40\b/g, replacement: 'bg-fuchsia-100 dark:bg-fuchsia-900/40' },
  { pattern: /\bbg-fuchsia-900\/60\b/g, replacement: 'bg-fuchsia-200 dark:bg-fuchsia-900/60' },
  
  // borders
  { pattern: /\bborder-violet-500\/20\b/g, replacement: 'border-violet-200 dark:border-violet-500/20' },
  { pattern: /\bborder-violet-500\/30\b/g, replacement: 'border-violet-300 dark:border-violet-500/30' },
  { pattern: /\bborder-fuchsia-500\/30\b/g, replacement: 'border-fuchsia-200 dark:border-fuchsia-500/30' },
  { pattern: /\bborder-fuchsia-500\/40\b/g, replacement: 'border-fuchsia-300 dark:border-fuchsia-500/40' },
  { pattern: /\bborder-fuchsia-400\b/g, replacement: 'border-fuchsia-600 dark:border-fuchsia-400' },
  
  // prose
  { pattern: /\bprose-invert\b/g, replacement: 'dark:prose-invert' }
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
