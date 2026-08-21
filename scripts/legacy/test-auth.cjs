const db = require('better-sqlite3')('data/soc.db');
db.prepare("INSERT OR IGNORE INTO users (id, email, role) VALUES ('test-id', 'admin@example.com', 'ADMIN')").run();

const jwt = require('jsonwebtoken');
const token = jwt.sign({ uid: 'test-id', email: 'admin@example.com', role: 'ADMIN' }, process.env.JWT_SECRET || 'your_jwt_secret_here');
console.log(token);
