const fs = require('fs');

let utils = fs.readFileSync('frontend/src/utils.ts', 'utf8');
utils = utils.replace(/return res;/g, `
    if (!res.ok) {
        const text = await res.text();
        console.error("API Error Response:", res.status, text.substring(0, 100));
        throw new Error(\`API returned \${res.status}: \${text.substring(0, 20)}\`);
    }
    return res;
`);
fs.writeFileSync('frontend/src/utils.ts', utils);
