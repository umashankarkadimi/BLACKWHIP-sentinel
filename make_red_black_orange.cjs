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

  // Change backgrounds to Black/Dark Gray
  content = content.replace(/bg-\[\#0f172a\]/g, 'bg-black');
  content = content.replace(/bg-\[\#1e293b\]/g, 'bg-[#111111]');
  
  // Change Light Mode bg
  content = content.replace(/bg-\[\#FDFBF7\]/g, 'bg-neutral-50');

  // Change slate to neutral (cleaner monochrome for red/black)
  content = content.replace(/slate/g, 'neutral');

  // Recharts / inline colors (chart line -> orange-500)
  content = content.replace(/#49c5b6/g, '#f97316'); 
  content = content.replace(/rgba\(73, 197, 182/g, 'rgba(239, 68, 68'); // borders/grid -> red-500
  
  // Glows/Alerts (Rust/Coral) -> Orange and Red
  content = content.replace(/rgba\(209, 72, 54/g, 'rgba(249, 115, 22'); 
  content = content.replace(/rgba\(223, 108, 79/g, 'rgba(239, 68, 68'); 

  // Brand utility classes mapping
  content = content.replace(/brand-teal-dark/g, 'red-700');
  content = content.replace(/brand-teal/g, 'red-500');
  content = content.replace(/brand-coral-dark/g, 'orange-700');
  content = content.replace(/brand-coral/g, 'orange-500');
  content = content.replace(/brand-rust-dark/g, 'red-900');
  content = content.replace(/brand-rust/g, 'red-600');
  
  // Prose text replacement
  content = content.replace(/prose-teal/g, 'prose-red');

  fs.writeFileSync(file, content, 'utf8');
});

let css = fs.readFileSync('frontend/src/index.css', 'utf8');

// Remove custom vars
css = css.replace(/--color-brand-teal: #49c5b6;\n/g, '');
css = css.replace(/--color-brand-teal-dark: #2a7a70;\n/g, '');
css = css.replace(/--color-brand-coral: #DF6C4F;\n/g, '');
css = css.replace(/--color-brand-coral-dark: #9e4630;\n/g, '');
css = css.replace(/--color-brand-rust: #D14836;\n/g, '');
css = css.replace(/--color-brand-rust-dark: #912f22;\n/g, '');

// CSS colors
css = css.replace(/rgba\(73, 197, 182/g, 'rgba(239, 68, 68'); // teal -> red-500
css = css.replace(/rgba\(209, 72, 54/g, 'rgba(249, 115, 22'); // rust -> orange-500
css = css.replace(/rgba\(15, 23, 42/g, 'rgba(0, 0, 0'); // scrollbar track
css = css.replace(/rgba\(30, 41, 59/g, 'rgba(17, 17, 17'); // dark hud-panel

fs.writeFileSync('frontend/src/index.css', css, 'utf8');
