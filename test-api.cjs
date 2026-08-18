const http = require('http');

http.get('http://localhost:3000/api/incidents', (res) => {
    let data = '';
    console.log("STATUS:", res.statusCode);
    console.log("HEADERS:", res.headers);
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log("BODY:", data.substring(0, 200)));
});
