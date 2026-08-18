const fs = require('fs');

// Patch backend/firebase.ts
let fb = fs.readFileSync('backend/firebase.ts', 'utf8');
fb = fb.replace(
    /app = initializeApp\(\{\s*projectId: process\.env\.FIREBASE_PROJECT_ID \|\| "protean-crane-ft8c4"\s*\}\);/g,
    `console.warn("FIREBASE ADMIN NOT CONFIGURED: Missing FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY. Backend Firestore operations will be skipped.");`
);
fb = fb.replace(
    /export const db = getFirestore\(app, firestoreDatabaseId\);/g,
    `export let db: any = null;\nif (app) db = getFirestore(app, firestoreDatabaseId);`
);
fs.writeFileSync('backend/firebase.ts', fb);

// Patch backend/server.ts
let server = fs.readFileSync('backend/server.ts', 'utf8');
server = server.replace(/const userDoc = await db\.collection/g, 'const userDoc = db ? await db.collection');
server = server.replace(/if \(\!userDoc\.exists\) return res\.status\(403\)\.json\(\{ error: 'User not found in DB' \}\);/g, 'if (userDoc && !userDoc.exists) return res.status(403).json({ error: \'User not found in DB\' });');
server = server.replace(/const snap = await db\.collection/g, 'if (!db) return;\n    const snap = await db.collection');
server = server.replace(/await db\.collection/g, 'if (db) await db.collection');
fs.writeFileSync('backend/server.ts', server);

