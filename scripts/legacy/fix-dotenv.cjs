const fs = require('fs');
let code = fs.readFileSync('backend/server.ts', 'utf8');

if (!code.includes("import 'dotenv/config';")) {
    code = "import 'dotenv/config';\n" + code;
    fs.writeFileSync('backend/server.ts', code);
}
