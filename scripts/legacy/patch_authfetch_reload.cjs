const fs = require('fs');

let utils = fs.readFileSync('frontend/src/utils.ts', 'utf8');
utils = utils.replace(/window\.location\.reload\(\);/g, `window.location.reload();\n        return new Promise(() => {}); // Halt execution while reloading`);
fs.writeFileSync('frontend/src/utils.ts', utils);
