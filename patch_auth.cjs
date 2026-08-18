const fs = require('fs');
let server = fs.readFileSync('backend/server.ts', 'utf8');
if (!server.includes('/api/me')) {
    server = server.replace(
        /\/\/ Data endpoints/g,
        `// Data endpoints
app.get("/api/me", authMiddleware, async (req, res) => {
    const user = req.user;
    // ensure user exists
    if (db) {
        const userRef = db.collection('users').doc(user.uid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
             await userRef.set({
                  email: user.email,
                  role: 'ANALYST'
             });
             user.role = 'ANALYST';
        }
    }
    res.json({ role: user.role });
});
`
    );
    fs.writeFileSync('backend/server.ts', server);
}

let authTs = fs.readFileSync('frontend/src/lib/AuthProvider.tsx', 'utf8');
authTs = authTs.replace(/import \{ doc, setDoc, getDoc \} from 'firebase\/firestore';/g, '');
authTs = authTs.replace(/import \{ auth, db \} from '\.\/firebase';/g, "import { auth } from './firebase';");
authTs = authTs.replace(/        const userRef = doc\(db, 'users', currentUser\.uid\);\s*const userSnap = await getDoc\(userRef\);\s*const data = userSnap\.data\(\);\s*if \(\!userSnap\.exists\(\) \|\| \!data\?\.role\) \{\s*await setDoc\(userRef, \{\s*displayName: currentUser\.displayName,\s*email: currentUser\.email,\s*role: 'ANALYST'\s*\}, \{ merge: true \}\);\s*setRole\('ANALYST'\);\s*\} else \{\s*setRole\(data\.role as any\);\s*\}/g,
`
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + token } });
            if (res.ok) {
                const data = await res.json();
                setRole(data.role);
            } else {
                setRole('ANALYST');
            }
        } catch (e) {
            setRole('ANALYST');
        }
`);
fs.writeFileSync('frontend/src/lib/AuthProvider.tsx', authTs);

