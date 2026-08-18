const fs = require('fs');

let utils = fs.readFileSync('frontend/src/utils.ts', 'utf8');
utils = utils.replace(/export async function authFetch\(url: string, options: RequestInit = \{\}\) \{/g, `export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {`);
utils = utils.replace(/return new Promise\(\(\) => \{\}\);/g, `return new Promise<Response>(() => {});`);
fs.writeFileSync('frontend/src/utils.ts', utils);
