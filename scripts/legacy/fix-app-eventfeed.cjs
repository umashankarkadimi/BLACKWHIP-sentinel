const fs = require('fs');
let code = fs.readFileSync('frontend/src/App.tsx', 'utf8');

code = code.replace(/<EventFeed events=\{events\} \/>/g, '<EventFeed events={events} mode={state.mode} />');

fs.writeFileSync('frontend/src/App.tsx', code);
