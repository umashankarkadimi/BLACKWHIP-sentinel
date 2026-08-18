const fs = require('fs');
let code = fs.readFileSync('backend/server.ts', 'utf8');

// We will replace app.post("/api/login"... with a 2-step process
const newLoginEndpoints = `
app.post("/api/login/init", (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });
    
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    if (!user) {
        const id = uuidv4();
        db.prepare('INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)').run(id, email, 'hash', 'ANALYST');
    }
    
    // In a real app we would send an email here.
    // For lab, we just return requiresVerification
    console.log(\`[Auth] Verification code for \${email} is: 123456\`);
    res.json({ requiresVerification: true });
});

app.post("/api/login/verify", (req, res) => {
    const { email, code } = req.body;
    if (code !== '123456') {
        return res.status(401).json({ error: 'Invalid verification code. Use 123456' });
    }
    
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const token = jwt.sign({ uid: user.id, email: user.email }, process.env.JWT_SECRET || 'lab_secret');
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});
`;

code = code.replace(/app\.post\("\/api\/login"[\s\S]*?res\.json\(\{ token \}\);\n\}\);/, newLoginEndpoints);

fs.writeFileSync('backend/server.ts', code);
