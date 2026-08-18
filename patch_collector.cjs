const fs = require('fs');
let code = fs.readFileSync('backend/services/wazuh-alert-collector.ts', 'utf8');

code = code.replace(/let lastTimestamp = new Date\(\)\.toISOString\(\);/g, `let lastTimestamp = new Date(Date.now() - 60000).toISOString(); // Look back 1 minute on startup
const seenIds = new Set<string>();`);

code = code.replace(/gt: lastTimestamp/g, `gte: lastTimestamp`);

code = code.replace(/const event = hit\._source;/g, `const event = hit._source;
                    if (seenIds.has(hit._id)) continue;
                    seenIds.add(hit._id);
                    if (seenIds.size > 1000) {
                        // Keep set from growing infinitely
                        const iter = seenIds.values();
                        for (let i = 0; i < 500; i++) seenIds.delete(iter.next().value!);
                    }`);

fs.writeFileSync('backend/services/wazuh-alert-collector.ts', code);
