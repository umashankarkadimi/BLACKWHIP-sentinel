const fs = require('fs');

let code = fs.readFileSync('frontend/src/components/TopBar.tsx', 'utf8');
code = code.replace(/const handleInject =[\s\S]*?2000\);\n  };/, '');

// Find the button with 'WARGAMES INJECTOR'
const startIndex = code.indexOf('<div className="relative group"'); // we might match the wrong one
// Let's just remove the button based on a reliable string match
code = code.replace(/<button[^>]*>\s*<Terminal[^>]*\/>\s*\{injecting \? 'INJECTING\.\.\.' : 'WARGAMES INJECTOR'\}\s*<\/button>/g, '');
// And the dropdown that comes after it...
code = code.replace(/<div className="absolute top-full left-0 pt-4 w-48 hidden group-hover:block z-50">[\s\S]*?<\/div>\s*<\/div>/, '');

fs.writeFileSync('frontend/src/components/TopBar.tsx', code);
