const fs = require('fs');
let server = fs.readFileSync('backend/server.ts', 'utf8');

const missingRoutes = `
app.get("/api/wazuh/agents", requireAuth, async (req, res) => {
  try {
      const result = await getAgents();
      res.json(result);
  } catch(e: any) {
      res.status(503).json({ error: e.message || 'Wazuh Offline' });
  }
});

app.post("/api/events/ingest", requireAuth, (req, res) => {
  try {
    ingestEvent(req.body);
    res.json({ status: "ingested" });
  } catch(e: any) {
    res.status(400).json({ error: e.message });
  }
});
`;

server = server.replace(/app\.get\("\/api\/state\/telemetry"/g, missingRoutes + "\napp.get(\"/api/state/telemetry\"");

fs.writeFileSync('backend/server.ts', server);
