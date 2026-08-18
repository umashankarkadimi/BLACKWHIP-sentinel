const db = require('better-sqlite3')('data/soc.db');
db.prepare("INSERT OR IGNORE INTO users (id, email, role) VALUES ('test-id', 'shankarkadimi@gmail.com', 'ADMIN')").run();

const jwt = require('jsonwebtoken');
const token = jwt.sign({ uid: 'test-id', email: 'shankarkadimi@gmail.com', role: 'ADMIN' }, process.env.JWT_SECRET || 'your_jwt_secret_here');
console.log(token);
