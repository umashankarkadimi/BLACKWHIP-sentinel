const fs = require('fs');
let server = fs.readFileSync('backend/server.ts', 'utf8');

server = server.replace(/function loadIncidents\(\) \{/g, `async function loadIncidents() {`);

server = server.replace(/store\.state\.activeIncidents = store\.incidents\.filter\(\(i: Incident\) => \(i\.status as string\) !== 'CLOSED' && \(i\.status as string\) !== 'RESOLVED'\)\.length;/g, `store.state.activeIncidents = store.incidents.filter((i: Incident) => (i.status as string) !== 'CLOSED' && (i.status as string) !== 'RESOLVED').length;
    // Load high alerts from OpenSearch if possible
    try {
        const { searchEvents } = require('./opensearch.js');
        // Actually, just keep memory state for now, but maybe query OpenSearch for counts later if needed.
    } catch(e) {}
`);

fs.writeFileSync('backend/server.ts', server);
