const fs = require('fs');

let code = fs.readFileSync('frontend/src/components/TopBar.tsx', 'utf8');

// Remove the handleInject function
code = code.replace(/const handleInject = async \([\s\S]*?\}, 2000\);\n  };/, '');

// Remove the Inject button block
// Look for `<div className="relative group">\n            <button className="flex items-center ... Inject\n            </button>`
// We can just use a regex
code = code.replace(/<div className="relative group">\s*<button[^>]*>\s*<Terminal[^>]*\/>\s*\{injecting \? 'INJECTING\.\.\.' : 'INJECT'\}\s*<\/button>\s*<div[^>]*>[\s\S]*?<\/div>\s*<\/div>/, '');
// Let me be safer and just do it by strings.
