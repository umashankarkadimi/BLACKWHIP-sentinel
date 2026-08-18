const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('frontend/src');
files.forEach(f => {
    let code = fs.readFileSync(f, 'utf8');
    if (f.includes('AuthProvider.tsx')) return;
    
    if (code.includes('fetch(') && !code.includes('authFetch')) {
        let importPath = './utils';
        if (f.split(path.sep).length > 3) importPath = '../utils';
        if (f.split(path.sep).length > 4) importPath = '../../utils'; // just in case
        
        code = "import { authFetch } from '" + importPath + "';\n" + code;
        code = code.replace(/fetch\(/g, 'authFetch(');
        fs.writeFileSync(f, code);
    }
});

let utilsCode = fs.readFileSync('frontend/src/utils.ts', 'utf8');
if (!utilsCode.includes('authFetch')) {
    utilsCode += `
export async function authFetch(url: string, options: RequestInit = {}) {
    const token = localStorage.getItem('soc_token');
    const headers = new Headers(options.headers || {});
    if (token) {
        headers.set('Authorization', \`Bearer \${token}\`);
    }
    const newOptions = { ...options, headers };
    const res = await fetch(url, newOptions);
    if (res.status === 401 || res.status === 403) {
        console.warn('Auth error', res.status);
        // Force re-auth
        localStorage.removeItem('soc_token');
        localStorage.removeItem('soc_user');
        window.location.reload();
    }
    return res;
}
`;
    fs.writeFileSync('frontend/src/utils.ts', utilsCode);
}
