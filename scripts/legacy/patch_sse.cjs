const fs = require('fs');
let server = fs.readFileSync('backend/server.ts', 'utf8');

server = server.replace(/app\.get\("\/api\/stream", \(req, res\) => \{/g, `app.get("/api/stream", (req, res) => {
  const token = req.query.token as string;
  if (!token) return res.status(401).end();
  try {
      const secret = process.env.JWT_SECRET;
      if (!secret) return res.status(500).end();
      jwt.verify(token, secret);
  } catch (e) {
      return res.status(401).end();
  }
`);

fs.writeFileSync('backend/server.ts', server);
