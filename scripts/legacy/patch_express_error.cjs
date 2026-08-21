const fs = require('fs');
let server = fs.readFileSync('backend/server.ts', 'utf8');
const errorHandler = `
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Express Error:", err);
    if (req.path.startsWith('/api/')) {
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    } else {
        next(err);
    }
});

async function startServer() {
`;
server = server.replace('async function startServer() {', errorHandler);
fs.writeFileSync('backend/server.ts', server);
